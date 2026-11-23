<?php

namespace App\Controller;

use App\Diagnostic\Questionnaire;
use App\Entity\Action;
use App\Entity\Document;
use App\Entity\QuestionDocument;
use App\Entity\User;

/**
 * A document as sent to the web app: shape of EvidenceDocument in
 * web/src/lib/api/types.ts. The stored name is never sent.
 */
final class DocumentView
{
    /**
     * @return array<string, mixed>
     */
    public static function of(Document $document, Questionnaire $questionnaire): array
    {
        return [
            'id' => (string) $document->getId(),
            'name' => $document->getOriginalName(),
            'mimeType' => $document->getMimeType(),
            'size' => $document->getSize(),
            'domain' => $document->getPillar()?->value,
            'uploadedBy' => self::person($document->getUploadedBy()),
            'createdAt' => $document->getCreatedAt()->format(\DATE_ATOM),
            // What the document proves (US-12)
            'actions' => array_map(static fn (Action $action): array => [
                'id' => (string) $action->getId(),
                'title' => $action->getTitle(),
            ], $document->getActions()->getValues()),
            'questions' => self::questions($document, $questionnaire),
        ];
    }

    /**
     * @return array{id: string, firstName: ?string, lastName: ?string, email: string}|null
     */
    public static function person(?User $user): ?array
    {
        return null === $user ? null : [
            'id' => (string) $user->getId(),
            'firstName' => $user->getFirstName(),
            'lastName' => $user->getLastName(),
            'email' => $user->getEmail(),
        ];
    }

    /**
     * Sorted by id. A question removed from the questionnaire keeps its id
     * as label.
     *
     * @return list<array{id: string, label: string}>
     */
    private static function questions(Document $document, Questionnaire $questionnaire): array
    {
        $questions = array_map(static function (QuestionDocument $link) use ($questionnaire): array {
            $label = $questionnaire->question($link->getQuestionId())['label'] ?? null;

            return [
                'id' => $link->getQuestionId(),
                'label' => \is_string($label) ? $label : $link->getQuestionId(),
            ];
        }, $document->getQuestionLinks()->getValues());

        usort($questions, static fn (array $a, array $b): int => strcmp($a['id'], $b['id']));

        return $questions;
    }
}
