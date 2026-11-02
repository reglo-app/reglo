<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Storage\AvatarStorage;
use App\Storage\InvalidAvatarException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Profile photos: changed by their owner only, seen only by the members of
 * the same organization (tenant isolation, rule 1).
 */
final class AvatarController
{
    public function __construct(
        private readonly AvatarStorage $storage,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Multipart form with the image in the "file" field.
     */
    #[Route('/api/me/avatar', name: 'avatar_upload', methods: ['POST'])]
    public function upload(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $file = $request->files->get('file');

        try {
            if (!$file instanceof UploadedFile) {
                throw new InvalidAvatarException(InvalidAvatarException::INVALID_IMAGE);
            }
            $fileName = $this->storage->store($file);
        } catch (InvalidAvatarException $exception) {
            return new JsonResponse([
                'error' => InvalidAvatarException::TOO_LARGE === $exception->reason
                    ? \sprintf('L\'image ne doit pas dépasser %d Mo.', AvatarStorage::MAX_BYTES / 1024 / 1024)
                    : 'Choisissez une image JPEG, PNG ou WebP.',
                'code' => $exception->reason,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $previous = $user->getAvatarFile();
        $user->setAvatarFile($fileName);
        $this->entityManager->flush();

        if (null !== $previous) {
            $this->storage->delete($previous);
        }

        return new JsonResponse(CurrentUserView::of($user));
    }

    #[Route('/api/me/avatar', name: 'avatar_delete', methods: ['DELETE'])]
    public function delete(#[CurrentUser] User $user): Response
    {
        $previous = $user->getAvatarFile();
        $user->setAvatarFile(null);
        $this->entityManager->flush();

        if (null !== $previous) {
            $this->storage->delete($previous);
        }

        return new Response(status: Response::HTTP_NO_CONTENT);
    }

    /**
     * 404 (never 403) for a user of another organization: their existence
     * must not leak.
     */
    #[Route('/api/users/{id}/avatar', name: 'avatar_show', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function show(int $id, #[CurrentUser] User $viewer, UserRepository $userRepository): BinaryFileResponse
    {
        $owner = $userRepository->find($id);
        $fileName = $owner?->getAvatarFile();

        if (null === $owner || null === $fileName || !self::canSee($viewer, $owner) || !is_file($this->storage->path($fileName))) {
            throw new NotFoundHttpException();
        }

        $response = new BinaryFileResponse($this->storage->path($fileName));
        $response->headers->set('Content-Type', 'image/webp');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        // The URL changes with each new photo (avatarVersion): it can be cached
        $response->setPrivate();
        $response->setMaxAge(86400);
        $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_INLINE, 'avatar.webp');

        return $response;
    }

    private static function canSee(User $viewer, User $owner): bool
    {
        if ($viewer->getId() === $owner->getId()) {
            return true;
        }

        $organization = $viewer->getOrganization();

        return null !== $organization && $organization->getId() === $owner->getOrganization()?->getId();
    }
}
