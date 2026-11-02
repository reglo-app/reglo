<?php

namespace App\Security;

use App\Entity\User;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Core\User\UserCheckerInterface;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * A user who has not chosen their password yet cannot log in. The failure
 * handler returns the usual generic message, so the response never tells
 * that the account exists.
 */
final class UserChecker implements UserCheckerInterface
{
    public function checkPreAuth(UserInterface $user): void
    {
        if ($user instanceof User && !$user->isActivated()) {
            throw new BadCredentialsException('The account is not activated.');
        }
    }

    public function checkPostAuth(UserInterface $user): void
    {
    }
}
