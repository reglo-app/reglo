<?php

namespace App\Platform;

use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Entity\User;
use App\Mailer\ActivationMailer;
use App\Repository\OrganizationRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Creates organizations and accounts for the REGLO team, from the onboarding
 * command or the back office, with the same rules. An account has no
 * password until its owner opens the link of the activation e-mail.
 */
final class AccountProvisioner
{
    public const NAME_INVALID = 'name_invalid';
    public const NAME_TAKEN = 'name_taken';
    public const EMAIL_INVALID = 'email_invalid';
    public const EMAIL_TAKEN = 'email_taken';
    public const FIRST_NAME_INVALID = 'first_name_invalid';
    public const LAST_NAME_INVALID = 'last_name_invalid';

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly OrganizationRepository $organizationRepository,
        private readonly UserRepository $userRepository,
        private readonly ActivationMailer $activationMailer,
        private readonly ValidatorInterface $validator,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * The problem with this name, or null. When renaming, $current may keep
     * its own name (e.g. to change the case).
     */
    public function nameError(string $name, ?Organization $current = null): ?string
    {
        $name = Organization::normalizeName($name);

        if ('' === $name || mb_strlen($name) > Organization::MAX_NAME_LENGTH) {
            return self::NAME_INVALID;
        }

        $isOwnName = null !== $current && mb_strtolower($current->getName()) === mb_strtolower($name);

        return !$isOwnName && $this->organizationRepository->existsWithName($name) ? self::NAME_TAKEN : null;
    }

    /**
     * The problems with these details, by field.
     *
     * @return array<'email'|'firstName'|'lastName', string>
     */
    public function personErrors(string $email, string $firstName, string $lastName): array
    {
        $errors = [];
        $email = User::normalizeEmail($email);

        if (\count($this->validator->validate($email, [new Assert\NotBlank(), new Assert\Email(), new Assert\Length(max: User::MAX_EMAIL_LENGTH)])) > 0) {
            $errors['email'] = self::EMAIL_INVALID;
        } elseif (null !== $this->userRepository->findOneByEmail($email)) {
            $errors['email'] = self::EMAIL_TAKEN;
        }

        return $errors + $this->personNameErrors($firstName, $lastName);
    }

    /**
     * The problems with a first and last name, by field: when creating an
     * account or renaming one.
     *
     * @return array<'firstName'|'lastName', string>
     */
    public function personNameErrors(string $firstName, string $lastName): array
    {
        $errors = [];

        if (!self::isValidName($firstName)) {
            $errors['firstName'] = self::FIRST_NAME_INVALID;
        }
        if (!self::isValidName($lastName)) {
            $errors['lastName'] = self::LAST_NAME_INVALID;
        }

        return $errors;
    }

    /**
     * The details must have passed nameError() and personErrors().
     */
    public function createOrganization(string $name, string $email, string $firstName, string $lastName): User
    {
        $organization = new Organization($name);
        $this->entityManager->persist($organization);

        return $this->createMember($organization, $email, $firstName, $lastName, OrganizationRole::Admin);
    }

    /**
     * The details must have passed personErrors().
     */
    public function createMember(Organization $organization, string $email, string $firstName, string $lastName, OrganizationRole $role): User
    {
        $user = (new User($email))
            ->setName(trim($firstName), trim($lastName))
            ->setOrganization($organization)
            ->setOrganizationRole($role);

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $user;
    }

    /**
     * A member of the REGLO team, outside any organization. The details must
     * have passed personErrors().
     */
    public function createPlatformAdmin(string $email, string $firstName, string $lastName): User
    {
        $user = (new User($email))
            ->setName(trim($firstName), trim($lastName))
            ->setRoles([User::ROLE_PLATFORM_ADMIN]);

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $user;
    }

    /**
     * False when the e-mail could not be sent: the account exists, the link
     * can be sent again.
     */
    public function sendActivation(User $user): bool
    {
        try {
            $this->activationMailer->send($user);
        } catch (TransportExceptionInterface $exception) {
            $this->logger->error('Activation e-mail could not be sent.', ['exception' => $exception]);

            return false;
        }

        return true;
    }

    private static function isValidName(string $name): bool
    {
        $name = trim($name);

        return '' !== $name && mb_strlen($name) <= User::MAX_NAME_LENGTH;
    }
}
