<?php

namespace App\Tests\Controller;

use App\Entity\Organization;
use App\Storage\AvatarStorage;
use Symfony\Component\HttpFoundation\File\UploadedFile;

final class AvatarControllerTest extends ProfileTestCase
{
    /** @var list<string> */
    private array $tempFiles = [];

    protected function tearDown(): void
    {
        array_map(unlink(...), array_filter($this->tempFiles, is_file(...)));
        parent::tearDown();
    }

    public function testStoresTheImageAsASmallSquareWebp(): void
    {
        $this->upload($this->image(800, 600, 'png'));

        self::assertResponseIsSuccessful();
        self::assertIsString($this->responseData()['avatarVersion']);
        $stored = $this->storedPath();
        self::assertSame('image/webp', mime_content_type($stored));
        self::assertSame([AvatarStorage::SIZE, AvatarStorage::SIZE], \array_slice((array) getimagesize($stored), 0, 2));
    }

    public function testDropsThePhotoMetadata(): void
    {
        $jpeg = $this->image(400, 400, 'jpeg');
        // A comment segment, like the camera data of a phone photo
        file_put_contents($jpeg, substr_replace((string) file_get_contents($jpeg), "\xFF\xFE\x00\x0FGPS 48.85,2.35", 2, 0));
        self::assertStringContainsString('GPS 48.85', (string) file_get_contents($jpeg));

        $this->upload($jpeg);

        self::assertResponseIsSuccessful();
        self::assertStringNotContainsString('GPS 48.85', (string) file_get_contents($this->storedPath()));
    }

    public function testANewPhotoReplacesTheOldFile(): void
    {
        $this->upload($this->image(300, 300, 'png'));
        $first = $this->storedPath();

        $this->upload($this->image(300, 300, 'png'));

        self::assertResponseIsSuccessful();
        self::assertFileDoesNotExist($first);
        self::assertFileExists($this->storedPath());
    }

    public function testRejectsAFileThatIsNotAnImage(): void
    {
        $fake = $this->tempFile('png');
        file_put_contents($fake, '<?php echo "not an image";');

        $this->upload($fake);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('invalid_image', $this->responseData()['code']);
        self::assertNull($this->userColumn('avatar_file'));
    }

    public function testRejectsATooLargeFile(): void
    {
        $large = $this->image(100, 100, 'png');
        file_put_contents($large, str_repeat("\0", AvatarStorage::MAX_BYTES), \FILE_APPEND);

        $this->upload($large);

        self::assertResponseStatusCodeSame(422);
        self::assertSame('too_large', $this->responseData()['code']);
    }

    public function testRejectsARequestWithoutFile(): void
    {
        $this->client->request('POST', '/api/me/avatar', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$this->token]);

        self::assertResponseStatusCodeSame(422);
    }

    public function testDeletesThePhoto(): void
    {
        $this->upload($this->image(300, 300, 'png'));
        $stored = $this->storedPath();

        $this->client->request('DELETE', '/api/me/avatar', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$this->token]);

        self::assertResponseStatusCodeSame(204);
        self::assertNull($this->userColumn('avatar_file'));
        self::assertFileDoesNotExist($stored);
    }

    public function testTheOwnerAndTheTeamSeeThePhoto(): void
    {
        $colleague = $this->createUser('paul@acme.test', $this->organization);
        $colleagueToken = $this->issueToken($colleague);
        $this->upload($this->image(300, 300, 'png'));

        foreach ([$this->token, $colleagueToken] as $token) {
            $this->getAs('/api/users/'.$this->user->getId().'/avatar', $token);

            self::assertResponseIsSuccessful();
            self::assertResponseHeaderSame('Content-Type', 'image/webp');
            self::assertResponseHeaderSame('X-Content-Type-Options', 'nosniff');
        }
    }

    public function testAnotherOrganizationCannotSeeThePhoto(): void
    {
        $other = new Organization('Other');
        $this->entityManager->persist($other);
        $outsider = $this->createUser('eve@other.test', $other);
        $platformAdmin = $this->createUser('team@reglo.test', null);
        $tokens = [$this->issueToken($outsider), $this->issueToken($platformAdmin)];
        $this->upload($this->image(300, 300, 'png'));

        foreach ($tokens as $token) {
            $this->getAs('/api/users/'.$this->user->getId().'/avatar', $token);

            // 404, not 403: the user must not even learn that it exists
            self::assertResponseStatusCodeSame(404);
        }
    }

    public function testAUserWithoutPhotoHasNone(): void
    {
        $this->getAs('/api/users/'.$this->user->getId().'/avatar');

        self::assertResponseStatusCodeSame(404);
    }

    public function testThePhotoNeedsALoggedInUser(): void
    {
        $this->client->request('GET', '/api/users/'.$this->user->getId().'/avatar');

        self::assertResponseStatusCodeSame(401);
    }

    private function upload(string $path): void
    {
        $this->client->request(
            'POST',
            '/api/me/avatar',
            files: ['file' => new UploadedFile($path, 'photo.'.pathinfo($path, \PATHINFO_EXTENSION), test: true)],
            server: ['HTTP_AUTHORIZATION' => 'Bearer '.$this->token],
        );
    }

    private function storedPath(): string
    {
        $fileName = $this->userColumn('avatar_file');
        self::assertIsString($fileName);

        return static::getContainer()->get(AvatarStorage::class)->path($fileName);
    }

    private function image(int $width, int $height, string $type): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, (int) imagecolorallocate($image, 15, 107, 99));
        $path = $this->tempFile($type);
        'png' === $type ? imagepng($image, $path) : imagejpeg($image, $path);

        return $path;
    }

    private function tempFile(string $extension): string
    {
        $path = sys_get_temp_dir().'/'.bin2hex(random_bytes(8)).'.'.$extension;
        $this->tempFiles[] = $path;

        return $path;
    }
}
