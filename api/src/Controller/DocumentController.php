<?php

namespace App\Controller;

use App\Diagnostic\Questionnaire;
use App\Entity\Document;
use App\Entity\DocumentAccess;
use App\Entity\DocumentAccessKind;
use App\Entity\OrganizationRole;
use App\Entity\QhsePillar;
use App\Entity\User;
use App\Repository\DocumentAccessRepository;
use App\Repository\DocumentRepository;
use App\Storage\DocumentStorage;
use App\Storage\InvalidDocumentException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Evidence documents of the organization (US-11, US-12). Every role
 * consults and downloads them, and each opening is logged; administrators
 * and members upload (readers are refused by security.yaml); a document is
 * deleted by its author or an administrator, with its links. Another
 * organization's document is never found (OrganizationFilter).
 */
#[Route('/api/documents', name: 'document_')]
final class DocumentController
{
    public const DELETE_FORBIDDEN = 'Seuls l\'auteur du justificatif et les administrateurs peuvent le supprimer.';
    public const ACCESSES_FORBIDDEN = 'Seuls les administrateurs consultent l\'historique des accès.';

    /** Values of the "period" filter: how far back. */
    private const PERIODS = ['30d' => '-30 days', '12m' => '-12 months'];

    /** Longest text searched in the names. */
    private const SEARCH_MAX_LENGTH = 100;

    /**
     * Shown in the browser: types found in the content at the upload that
     * cannot run in a page. Never anything else, whatever the file.
     */
    private const VIEWABLE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

    private const MESSAGES = [
        InvalidDocumentException::TOO_LARGE => 'Ce fichier dépasse la taille maximale de 20 Mo.',
        InvalidDocumentException::INVALID_TYPE => 'Ce format n\'est pas accepté. Déposez un PDF, une image (PNG, JPEG) ou un tableur (XLSX, CSV).',
        InvalidDocumentException::EMPTY_FILE => 'Ce fichier est vide.',
        InvalidDocumentException::UPLOAD_FAILED => 'Le fichier n\'a pas été reçu en entier. Réessayez.',
    ];

    public function __construct(
        private readonly DocumentRepository $repository,
        private readonly DocumentStorage $storage,
        private readonly EntityManagerInterface $entityManager,
        private readonly DocumentAccessRepository $accesses,
        private readonly Questionnaire $questionnaire,
    ) {
    }

    /**
     * Latest first. Optional filters (US-12): q (part of the name), format
     * (pdf, image, spreadsheet), domain, author (id), period (30d, 12m), and
     * sort (recent, oldest, name).
     */
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $query = $request->query;
        $search = trim($query->getString('q'));
        $format = $query->getString('format');
        $pillar = QhsePillar::tryFrom($query->getString('domain'));
        $author = $query->getString('author');
        $period = $query->getString('period');
        $sort = $query->getString('sort');

        if (
            mb_strlen($search) > self::SEARCH_MAX_LENGTH
            || ('' !== $format && !isset(DocumentRepository::FORMATS[$format]))
            || (null === $pillar && '' !== $query->getString('domain'))
            || ('' !== $author && !ctype_digit($author))
            || ('' !== $period && !isset(self::PERIODS[$period]))
            || ('' !== $sort && !\in_array($sort, DocumentRepository::SORTS, true))
        ) {
            return self::error('Ce filtre n\'existe pas.', 'invalid_filter');
        }

        $documents = $this->repository->findFiltered(
            $search,
            '' === $format ? null : $format,
            $pillar,
            '' === $author ? null : (int) $author,
            '' === $period ? null : new \DateTimeImmutable(self::PERIODS[$period]),
            '' === $sort ? 'recent' : $sort,
        );

        return new JsonResponse(array_map($this->view(...), $documents));
    }

    /**
     * Multipart form with the file in the "file" field and, optionally, the
     * QHSE pillar in "domain".
     */
    #[Route('', name: 'upload', methods: ['POST'])]
    public function upload(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $organization = $user->getOrganization();
        if (null === $organization) {
            return self::error('Votre compte n\'appartient à aucune organisation.', 'no_organization', Response::HTTP_FORBIDDEN);
        }

        $domain = $request->request->all()['domain'] ?? '';
        $pillar = \is_string($domain) ? QhsePillar::tryFrom($domain) : null;
        if (null === $pillar && '' !== $domain) {
            return self::error('Choisissez un des quatre domaines QHSE, ou aucun.', 'invalid_domain');
        }

        $file = $request->files->get('file');
        if (!$file instanceof UploadedFile) {
            // Over post_max_size, PHP drops the whole body.
            return $request->server->getInt('CONTENT_LENGTH') > DocumentStorage::MAX_BYTES
                ? self::error(self::MESSAGES[InvalidDocumentException::TOO_LARGE], InvalidDocumentException::TOO_LARGE)
                : self::error('Choisissez le fichier à déposer.', 'no_file');
        }

        $name = DocumentStorage::cleanName($file->getClientOriginalName(), Document::ORIGINAL_NAME_MAX_LENGTH);
        try {
            $stored = $this->storage->store($file);
        } catch (InvalidDocumentException $exception) {
            return self::error(self::MESSAGES[$exception->reason], $exception->reason);
        }

        $document = new Document($organization, $name, $stored['storedName'], $stored['mimeType'], $stored['size'], $pillar, $user);
        try {
            $this->entityManager->persist($document);
            $this->entityManager->flush();
        } catch (\Throwable $exception) {
            // No file without its document.
            $this->storage->delete($stored['storedName']);

            throw $exception;
        }

        return new JsonResponse($this->view($document), Response::HTTP_CREATED);
    }

    /**
     * Always a download with the type found at the upload, never shown in
     * the browser: a file cannot run as a page of the application.
     */
    #[Route('/{id}/download', name: 'download', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function download(int $id, #[CurrentUser] User $user): Response
    {
        $document = $this->findDocument($id, $user);
        if (null === $document || !is_file($this->storage->path($document->getStoredName()))) {
            return self::notFound();
        }
        $this->accesses->record($document, $user, DocumentAccessKind::Download);

        return $this->fileResponse($document, ResponseHeaderBag::DISPOSITION_ATTACHMENT, "default-src 'none'; sandbox");
    }

    /**
     * The file shown in the browser, and in the pages of the app only: PDF
     * and images. No "sandbox" here: these types do not need it, and a
     * browser may refuse to show a PDF with it.
     */
    #[Route('/{id}/view', name: 'view', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function show(int $id, #[CurrentUser] User $user): Response
    {
        $document = $this->findDocument($id, $user);
        if (null === $document || !is_file($this->storage->path($document->getStoredName()))) {
            return self::notFound();
        }
        if (!\in_array($document->getMimeType(), self::VIEWABLE_TYPES, true)) {
            return self::error('Ce format ne peut pas être affiché : téléchargez le fichier.', 'not_viewable', Response::HTTP_NOT_FOUND);
        }
        $this->accesses->record($document, $user, DocumentAccessKind::View);

        return $this->fileResponse($document, ResponseHeaderBag::DISPOSITION_INLINE, "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'");
    }

    /**
     * Who opened the document, latest first (US-12): administrators only.
     */
    #[Route('/{id}/accesses', name: 'accesses', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function accesses(int $id, #[CurrentUser] User $user): JsonResponse
    {
        $document = $this->findDocument($id, $user);
        if (null === $document) {
            return self::notFound();
        }
        if (OrganizationRole::Admin !== $user->getOrganizationRole()) {
            return self::error(self::ACCESSES_FORBIDDEN, 'accesses_forbidden', Response::HTTP_FORBIDDEN);
        }

        return new JsonResponse(array_map(static fn (DocumentAccess $access): array => [
            'by' => DocumentView::person($access->getAccessedBy()),
            'kind' => $access->getKind()->value,
            'at' => $access->getAccessedAt()->format(\DATE_ATOM),
        ], $this->accesses->findForDocument($document)));
    }

    #[Route('/{id}', name: 'delete', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function delete(int $id, #[CurrentUser] User $user): Response
    {
        $document = $this->findDocument($id, $user);
        if (null === $document) {
            return self::notFound();
        }

        if (OrganizationRole::Admin !== $user->getOrganizationRole() && $document->getUploadedBy()?->getId() !== $user->getId()) {
            return self::error(self::DELETE_FORBIDDEN, 'delete_forbidden', Response::HTTP_FORBIDDEN);
        }

        $storedName = $document->getStoredName();
        $this->entityManager->remove($document);
        $this->entityManager->flush();
        $this->storage->delete($storedName);

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    private function fileResponse(Document $document, string $disposition, string $securityPolicy): BinaryFileResponse
    {
        $response = new BinaryFileResponse($this->storage->path($document->getStoredName()));
        $response->headers->set('Content-Type', $document->getMimeType());
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Content-Security-Policy', $securityPolicy);
        $response->setPrivate();
        $response->headers->addCacheControlDirective('no-store');
        $response->setContentDisposition($disposition, $document->getOriginalName());

        return $response;
    }

    /**
     * The document, if it belongs to the organization of the user. Already
     * ensured by OrganizationFilter; checked again in case it was loaded
     * earlier in the request, from memory, without the filter.
     */
    private function findDocument(int $id, User $user): ?Document
    {
        $document = $this->repository->find($id);
        $organization = $user->getOrganization();

        if (null === $document || null === $organization || $document->getOrganization()?->getId() !== $organization->getId()) {
            return null;
        }

        return $document;
    }

    /**
     * @return array<string, mixed>
     */
    private function view(Document $document): array
    {
        return DocumentView::of($document, $this->questionnaire);
    }

    private static function error(string $message, string $code, int $status = Response::HTTP_UNPROCESSABLE_ENTITY): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], $status);
    }

    private static function notFound(): JsonResponse
    {
        return self::error('Ce justificatif n\'existe pas ou a été supprimé.', 'not_found', Response::HTTP_NOT_FOUND);
    }
}
