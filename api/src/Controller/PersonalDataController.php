<?php

namespace App\Controller;

use App\Account\OrganizationMembers;
use App\Account\PersonalDataExporter;
use App\Entity\User;
use App\Mailer\ProfileMailer;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * GDPR rights of the signed-in user (US-04): download their personal data,
 * and delete their own account. Every role can, readers included.
 */
#[Route('/api/me', name: 'personal_data_')]
final class PersonalDataController
{
    public const WRONG_PASSWORD = 'Le mot de passe est incorrect.';
    public const LAST_ADMIN = 'Vous êtes le dernier administrateur de votre organisation : nommez d\'abord un autre administrateur depuis la page Équipe.';
    public const TEAM_ACCOUNT = 'Un compte de l\'équipe Réglo se supprime depuis le back office, par un autre membre de l\'équipe.';

    /**
     * A JSON file: profile, organization, and what the user did in it.
     */
    #[Route('/export', name: 'export', methods: ['GET'])]
    public function export(#[CurrentUser] User $user, PersonalDataExporter $exporter): Response
    {
        $response = new Response(json_encode(
            $exporter->export($user),
            \JSON_PRETTY_PRINT | \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES | \JSON_THROW_ON_ERROR,
        ));
        $response->headers->set('Content-Type', 'application/json; charset=utf-8');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Content-Disposition', $response->headers->makeDisposition('attachment', PersonalDataExporter::fileName()));
        $response->setPrivate();
        $response->headers->addCacheControlDirective('no-store');

        return $response;
    }

    /**
     * Body: {"password"}. Deletes the account: profile, photo and sessions
     * at once. What the user did for the organization stays, without their
     * name ("Ancien membre"). An e-mail confirms it to the old address.
     */
    #[Route('', name: 'delete', methods: ['DELETE'])]
    public function delete(
        Request $request,
        #[CurrentUser] User $user,
        UserPasswordHasherInterface $passwordHasher,
        OrganizationMembers $members,
        ProfileMailer $mailer,
        LoggerInterface $logger,
    ): Response {
        if ($user->isPlatformAdmin()) {
            return self::error(self::TEAM_ACCOUNT, 'team_account');
        }
        if (!$passwordHasher->isPasswordValid($user, JsonBody::string($request, 'password'))) {
            return self::error(self::WRONG_PASSWORD, 'wrong_password');
        }

        $email = $user->getEmail();
        $firstName = $user->getFirstName();
        if (!$members->remove($user)) {
            return self::error(self::LAST_ADMIN, 'last_admin');
        }

        try {
            $mailer->sendAccountDeletedNotice($email, $firstName);
        } catch (TransportExceptionInterface $exception) {
            // The account is deleted all the same: only the notice is lost.
            $logger->error('The account deletion e-mail could not be sent.', ['exception' => $exception]);
        }

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    private static function error(string $message, string $code): JsonResponse
    {
        return new JsonResponse(['error' => $message, 'code' => $code], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
