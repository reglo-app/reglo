<?php

namespace App\Security;

use App\Command\CreateUserCommand;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;

/**
 * Rule of every password chosen in the app (activation, change).
 */
final class PasswordPolicy
{
    public static function isAcceptable(string $password): bool
    {
        return mb_strlen($password) >= CreateUserCommand::MIN_PASSWORD_LENGTH
            && \strlen($password) <= PasswordHasherInterface::MAX_PASSWORD_LENGTH;
    }

    public static function errorMessage(): string
    {
        return \sprintf('Le mot de passe doit contenir au moins %d caractères.', CreateUserCommand::MIN_PASSWORD_LENGTH);
    }
}
