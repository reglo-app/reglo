<?php

namespace App\Controller;

use App\Diagnostic\Questionnaire;
use App\Entity\Document;
use App\Entity\QuestionDocument;
use App\Entity\User;
use App\Repository\DocumentRepository;
use App\Repository\QuestionDocumentRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Evidence of a question of the diagnostic (US-12), for the organization:
 * administrators and members link and unlink documents (readers are refused
 * by security.yaml). The question id is in the body, not in the URL: its
 * dots would look like a file extension to web servers. The links are read
 * with the documents (GET /api/documents).
 */
#[Route('/api/question-documents', name: 'question_document_')]
final class QuestionDocumentController
{
    public function __construct(
        private readonly DocumentRepository $documents,
        private readonly QuestionDocumentRepository $links,
        private readonly EntityManagerInterface $entityManager,
        private readonly Questionnaire $questionnaire,
    ) {
    }

    /**
     * Body: {"questionId", "documentId"}. Linking twice changes nothing.
     */
    #[Route('', name: 'link', methods: ['PUT'])]
    public function link(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $input = $this->readInput($request, $user);
        if ($input instanceof JsonResponse) {
            return $input;
        }
        [$document, $questionId] = $input;

        $created = false;
        if (null === $this->links->findLink($document, $questionId)) {
            $this->entityManager->persist(new QuestionDocument($document, $questionId, $user));
            $this->entityManager->flush();
            $created = true;
        }

        return new JsonResponse(DocumentView::of($document, $this->questionnaire), $created ? Response::HTTP_CREATED : Response::HTTP_OK);
    }

    /**
     * Body: {"questionId", "documentId"}. The document stays in the list of
     * the organization; removing a link that does not exist changes nothing.
     */
    #[Route('', name: 'unlink', methods: ['DELETE'])]
    public function unlink(Request $request, #[CurrentUser] User $user): Response
    {
        $input = $this->readInput($request, $user);
        if ($input instanceof JsonResponse) {
            return $input;
        }
        [$document, $questionId] = $input;

        $link = $this->links->findLink($document, $questionId);
        if (null !== $link) {
            $document->getQuestionLinks()->removeElement($link);
            $this->entityManager->remove($link);
            $this->entityManager->flush();
        }

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * @return array{Document, string}|JsonResponse
     */
    private function readInput(Request $request, User $user): array|JsonResponse
    {
        $questionId = JsonBody::string($request, 'questionId');
        if (null === $this->questionnaire->question($questionId)) {
            return new JsonResponse(['error' => 'Cette question n\'existe pas.', 'code' => 'invalid_question'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $documentId = JsonBody::string($request, 'documentId');
        $document = ctype_digit($documentId) ? $this->documents->find((int) $documentId) : null;
        $own = $user->getOrganization()?->getId();
        // Already ensured by OrganizationFilter; checked again in case the
        // document was loaded earlier in the request without the filter.
        if (null === $document || null === $own || $document->getOrganization()?->getId() !== $own) {
            return new JsonResponse(['error' => 'Ce justificatif n\'existe pas ou a été supprimé.', 'code' => 'document_not_found'], Response::HTTP_NOT_FOUND);
        }

        return [$document, $questionId];
    }
}
