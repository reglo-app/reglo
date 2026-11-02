<?php

namespace App\Controller;

use App\Mailer\ProfileMailer;
use App\Security\EmailChangeManager;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Link of the e-mail sent to a new address (see ProfileController). Public
 * routes: the token is the proof that the user owns the new address.
 */
#[Route('/api/email-change', name: 'email_change_')]
final class EmailChangeController
{
    public const INVALID_LINK = 'Ce lien de confirmation a expiré ou a déjà été utilisé.';

    public function __construct(
        private readonly EmailChangeManager $emailChangeManager,
    ) {
    }

    /**
     * Lets the web app show the new address before the user confirms.
     */
    #[Route('/check', name: 'check', methods: ['POST'])]
    public function check(Request $request): JsonResponse
    {
        $changeRequest = $this->emailChangeManager->findValid(JsonBody::string($request, 'token'));

        return null === $changeRequest
            ? self::invalidLink()
            : new JsonResponse(['newEmail' => $changeRequest->getNewEmail()]);
    }

    #[Route('/confirm', name: 'confirm', methods: ['POST'])]
    public function confirm(Request $request, ProfileMailer $profileMailer, LoggerInterface $logger): Response
    {
        $changeRequest = $this->emailChangeManager->findValid(JsonBody::string($request, 'token'));

        if (null === $changeRequest) {
            return self::invalidLink();
        }

        // Another account may have taken it since the request
        if ($this->emailChangeManager->isEmailTaken($changeRequest->getNewEmail())) {
            return new JsonResponse([
                'error' => 'Cette adresse e-mail n\'est plus disponible. Choisissez-en une autre depuis votre profil.',
                'code' => 'email_unavailable',
            ], Response::HTTP_CONFLICT);
        }

        $user = $changeRequest->getUser();
        $oldEmail = $user->getEmail();
        $this->emailChangeManager->confirm($changeRequest);

        try {
            $profileMailer->sendEmailChangedNotice($user, $oldEmail);
        } catch (TransportExceptionInterface $exception) {
            $logger->error('E-mail changed notice could not be sent.', ['exception' => $exception]);
        }

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    private static function invalidLink(): JsonResponse
    {
        return new JsonResponse(['error' => self::INVALID_LINK, 'code' => 'invalid_token'], Response::HTTP_GONE);
    }
}
