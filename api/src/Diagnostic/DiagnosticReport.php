<?php

namespace App\Diagnostic;

use App\Entity\Diagnostic;
use Dompdf\Dompdf;
use Dompdf\Options;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Twig\Environment;

/**
 * The summary of a submitted diagnostic as a PDF (US-07), with the content
 * of the result page: organization, date, global score, scores by pillar
 * and by theme, priority gaps and a reminder of the method. Rendered on the
 * server with Dompdf from a Twig template; nothing is loaded from outside.
 */
final class DiagnosticReport
{
    private const TIME_ZONE = 'Europe/Paris';

    public function __construct(
        private readonly Environment $twig,
        private readonly Questionnaire $questionnaire,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
        #[Autowire('%kernel.cache_dir%')]
        private readonly string $cacheDir,
    ) {
    }

    /**
     * The PDF file. The diagnostic must be submitted (with its score).
     */
    public function render(Diagnostic $diagnostic): string
    {
        $html = $this->twig->render('pdf/diagnostic.html.twig', $this->data($diagnostic));

        $fontCache = $this->cacheDir.'/dompdf';
        if (!is_dir($fontCache)) {
            mkdir($fontCache, recursive: true);
        }
        $options = (new Options())
            ->setDefaultFont('DejaVu Sans')
            ->setIsRemoteEnabled(false)
            ->setIsPhpEnabled(false)
            ->setIsJavascriptEnabled(false)
            ->setFontCache($fontCache)
            ->setTempDir($fontCache)
            ->setChroot([$this->projectDir.'/assets']);

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4');
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->render();

        return (string) $dompdf->output();
    }

    /**
     * "reglo-diagnostic-2026-11-23.pdf": the day it was submitted, in France.
     */
    public static function fileName(Diagnostic $diagnostic): string
    {
        $date = ($diagnostic->getSubmittedAt() ?? $diagnostic->getUpdatedAt())->setTimezone(new \DateTimeZone(self::TIME_ZONE));

        return \sprintf('reglo-diagnostic-%s.pdf', $date->format('Y-m-d'));
    }

    /**
     * @return array<string, mixed>
     */
    private function data(Diagnostic $diagnostic): array
    {
        $score = $diagnostic->getScore() ?? [];
        $pillarScores = \is_array($score['pillars'] ?? null) ? $score['pillars'] : [];
        $themeScores = \is_array($score['themes'] ?? null) ? $score['themes'] : [];

        $pillars = [];
        $pillarLabels = [];
        foreach ($this->questionnaire->toArray()['pillars'] as $pillar) {
            $pillarLabels[$pillar['id']] = $pillar['label'];
            if (!\array_key_exists($pillar['id'], $pillarScores)) {
                continue;
            }
            $themes = [];
            foreach ($pillar['themes'] ?? [] as $theme) {
                if (\array_key_exists($theme['id'], $themeScores)) {
                    $themes[] = ['label' => $theme['label'], 'score' => self::round($themeScores[$theme['id']])];
                }
            }
            $pillars[] = [
                'label' => $pillar['label'],
                'score' => self::round($pillarScores[$pillar['id']]),
                'themes' => $themes,
            ];
        }

        $gaps = [];
        foreach (\is_array($score['gaps'] ?? null) ? $score['gaps'] : [] as $gap) {
            $gaps[] = [
                'label' => $gap['label'] ?? '',
                'pillar' => $pillarLabels[$gap['pillar'] ?? ''] ?? '',
                'gain' => self::round($gap['potential_points'] ?? null),
                'cappedForProof' => true === ($gap['capped_for_proof'] ?? false),
            ];
        }

        $logo = $this->projectDir.'/assets/email/reglo-symbol.png';
        $submittedAt = ($diagnostic->getSubmittedAt() ?? $diagnostic->getUpdatedAt())->setTimezone(new \DateTimeZone(self::TIME_ZONE));
        $coverage = $score['coverage'] ?? null;

        return [
            'organization' => $diagnostic->getOrganization()?->getName() ?? '',
            'date' => self::frenchDate($submittedAt),
            'global' => self::round($score['global'] ?? null),
            'maturity' => \is_string($score['maturity'] ?? null) ? $score['maturity'] : null,
            'coverage' => is_numeric($coverage) ? (int) round((float) $coverage * 100) : null,
            'pillars' => $pillars,
            'gaps' => $gaps,
            'questionnaireVersion' => $diagnostic->getQuestionnaireVersion(),
            'algoVersion' => \is_string($score['algoVersion'] ?? null) ? $score['algoVersion'] : null,
            'logo' => is_file($logo) ? 'data:image/png;base64,'.base64_encode((string) file_get_contents($logo)) : null,
        ];
    }

    private static function round(mixed $value): ?int
    {
        return is_numeric($value) ? (int) round((float) $value) : null;
    }

    private static function frenchDate(\DateTimeImmutable $date): string
    {
        $months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

        return \sprintf('%d %s %d', (int) $date->format('j'), $months[(int) $date->format('n') - 1], (int) $date->format('Y'));
    }
}
