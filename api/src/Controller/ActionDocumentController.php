<?php

namespace App\Controller;

use App\Diagnostic\Questionnaire;
use App\Entity\Action;
use App\Entity\Document;
use App\Entity\User;
use App\Repository\ActionRepository;
use App\Repository\DocumentRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Evidence of an action (US-12): administrators and members link and unlink
 * documents, like they change an action (readers are refused by
 * security.yaml). Both must belong to the organization of the user:
 * otherwise, not found.
 */
#[Route('/api/actions/{id}/documents', name: 'action_document_', requirements: ['id' => '\d+'])]
final class ActionDocumentController
{
    public function __construct(
        private readonly ActionRepository $actions,
        private readonly DocumentRepository $documents,
        private readonly EntityManagerInterface $entityManager,
        private readonly Questionnaire $questionnaire,
    ) {
    }

    /**
     * Body: {"documentId"}. Linking a document twice changes nothing.
     */
    #[Route('', name: 'link', methods: ['POST'])]
    public function link(int $id, Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $action = $this->findAction($id, $user);
        if (null === $action) {
            return self::actionNotFound();
        }

        $documentId = JsonBody::string($request, 'documentId');
        $document = ctype_digit($documentId) ? $this->findDocument((int) $documentId, $user) : null;
        if (null === $document) {
            return self::documentNotFound();
        }

        $created = $action->attachDocument($document);
        $this->entityManager->flush();

        return new JsonResponse(DocumentView::of($document, $this->questionnaire), $created ? Response::HTTP_CREATED : Response::HTTP_OK);
    }

    /**
     * The document stays in the list of the organization. Removing a link
     * that does not exist changes nothing.
     */
    #[Route('/{documentId}', name: 'unlink', requirements: ['documentId' => '\d+'], methods: ['DELETE'])]
    public function unlink(int $id, int $documentId, #[CurrentUser] User $user): Response
    {
        $action = $this->findAction($id, $user);
        if (null === $action) {
            return self::actionNotFound();
        }

        $document = $this->findDocument($documentId, $user);
        if (null !== $document) {
            $action->detachDocument($document);
            $this->entityManager->flush();
        }

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * Already ensured by OrganizationFilter; checked again in case it was
     * loaded earlier in the request, from memory, without the filter.
     */
    private function findAction(int $id, User $user): ?Action
    {
        $action = $this->actions->find($id);

        return null !== $action && self::sameOrganization($action->getOrganization()?->getId(), $user) ? $action : null;
    }

    private function findDocument(int $id, User $user): ?Document
    {
        $document = $this->documents->find($id);

        return null !== $document && self::sameOrganization($document->getOrganization()?->getId(), $user) ? $document : null;
    }

    private static function sameOrganization(?int $organizationId, User $user): bool
    {
        $own = $user->getOrganization()?->getId();

        return null !== $own && $own === $organizationId;
    }

    private static function actionNotFound(): JsonResponse
    {
        return new JsonResponse(['error' => 'Cette action n\'existe pas ou a été supprimée.', 'code' => 'not_found'], Response::HTTP_NOT_FOUND);
    }

    private static function documentNotFound(): JsonResponse
    {
        return new JsonResponse(['error' => 'Ce justificatif n\'existe pas ou a été supprimé.', 'code' => 'document_not_found'], Response::HTTP_NOT_FOUND);
    }
}
