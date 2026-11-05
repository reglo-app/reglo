<?php

namespace App\Tests\Controller;

use App\Controller\DocumentController;
use App\Entity\Organization;
use App\Entity\OrganizationRole;
use App\Storage\DocumentStorage;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * US-11. The logged-in user of ProfileTestCase is a member of Acme. Users
 * are created before the first request: requests reboot the kernel, so the
 * entity manager.
 */
final class DocumentControllerTest extends ProfileTestCase
{
    private const PDF = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n";
    /** A 1x1 transparent PNG. */
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    /** @var list<string> */
    private array $tempFiles = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->emptyDocumentsFolder();
    }

    protected function tearDown(): void
    {
        array_map(unlink(...), array_filter($this->tempFiles, is_file(...)));
        $this->emptyDocumentsFolder();
        parent::tearDown();
    }

    /**
     * @return iterable<string, array{string, string, string}>
     */
    public static function acceptedFiles(): iterable
    {
        yield 'PDF' => ['duerp-2026.pdf', self::PDF, 'application/pdf'];
        yield 'PNG' => ['plan.png', (string) base64_decode(self::PNG, true), 'image/png'];
        yield 'JPEG' => ['photo.jpg', self::jpeg(), 'image/jpeg'];
        yield 'JPEG, other extension' => ['photo.jpeg', self::jpeg(), 'image/jpeg'];
        yield 'extension in capitals' => ['RAPPORT.PDF', self::PDF, 'application/pdf'];
        yield 'XLSX' => ['registre.xlsx', self::workbook(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        yield 'CSV' => ['registre.csv', "date;contrôle;résultat\n2026-11-05;extincteurs;conforme\n", 'text/csv'];
    }

    #[DataProvider('acceptedFiles')]
    public function testAcceptedFormatsAreKept(string $name, string $content, string $type): void
    {
        $this->upload($name, $content);

        self::assertResponseStatusCodeSame(201);
        $document = $this->responseData();
        self::assertSame($name, $document['name']);
        self::assertSame($type, $document['mimeType']);
        self::assertSame(\strlen($content), $document['size']);
        self::assertNull($document['domain']);
        self::assertSame((string) $this->user->getId(), $document['uploadedBy']['id']);
        self::assertIsString($document['createdAt']);
    }

    public function testTheFileIsKeptUnderARandomNameOutsideThePublicFolder(): void
    {
        $this->upload('duerp-2026.pdf', self::PDF);

        self::assertResponseStatusCodeSame(201);
        $response = (string) $this->client->getResponse()->getContent();
        $storedName = $this->entityManager->getConnection()->fetchOne('SELECT stored_name FROM document');
        self::assertIsString($storedName);
        self::assertMatchesRegularExpression('/^[0-9a-f]{32}$/', $storedName);
        self::assertStringNotContainsString($storedName, $response);
        self::assertSame([$storedName], $this->storedFiles());
        self::assertStringNotContainsString('/public', $this->documentsFolder());
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function refusedFiles(): iterable
    {
        yield 'false PDF, a page with the right extension' => ['faux.pdf', '<html><script>alert(1)</script></html>'];
        yield 'false PDF, a PHP script' => ['faux.pdf', '<?php echo "pirate";'];
        yield 'false image, a program' => ['photo.png', "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF"];
        yield 'an image with the extension of another format' => ['rapport.pdf', (string) base64_decode(self::PNG, true)];
        yield 'a PDF with the extension of an image' => ['photo.jpg', self::PDF];
        yield 'a page named as a table' => ['registre.csv', "<!DOCTYPE html>\n<html><body><script>alert(1)</script></body></html>\n"];
        yield 'a PHP script named as a table' => ['registre.csv', "<?php\nsystem(\$_GET['c']);\n"];
        yield 'binary data named as a table' => ['registre.csv', "\x00\x01\x02\x03\xFF\xFE\x00\x00binary"];
        yield 'an archive named as a workbook' => ['registre.xlsx', self::archive(['readme.txt' => 'hello'])];
        yield 'not an archive named as a workbook' => ['registre.xlsx', self::PDF];
        yield 'a workbook with macros' => ['registre.xlsx', self::workbook(['xl/vbaProject.bin' => 'macros'])];
        yield 'a real PDF with another extension' => ['rapport.exe', self::PDF];
        yield 'a real PDF with a double extension' => ['rapport.pdf.php', self::PDF];
        yield 'no extension' => ['rapport', self::PDF];
        yield 'a vector image' => ['logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'];
        yield 'a text document' => ['notes.docx', self::archive(['word/document.xml' => '<w/>'])];
    }

    #[DataProvider('refusedFiles')]
    public function testOtherFilesAreRefusedWhateverTheirExtension(string $name, string $content): void
    {
        $this->upload($name, $content);

        self::assertResponseStatusCodeSame(422);
        $data = $this->responseData();
        self::assertSame('invalid_type', $data['code']);
        self::assertStringContainsString('Ce format n\'est pas accepté', $data['error']);
        $this->assertNothingKept();
    }

    public function testAFileOfExactly20MegabytesIsAccepted(): void
    {
        $this->upload('gros.pdf', str_pad(self::PDF, DocumentStorage::MAX_BYTES, "\n"));

        self::assertResponseStatusCodeSame(201);
        self::assertSame(DocumentStorage::MAX_BYTES, $this->responseData()['size']);
    }

    public function testOneByteMoreIsRefusedWithAClearMessage(): void
    {
        $this->upload('gros.pdf', str_pad(self::PDF, DocumentStorage::MAX_BYTES + 1, "\n"));

        self::assertResponseStatusCodeSame(422);
        self::assertSame([
            'error' => 'Ce fichier dépasse la taille maximale de 20 Mo.',
            'code' => 'too_large',
        ], $this->responseData());
        $this->assertNothingKept();
    }

    public function testAnEmptyFileOrNoFileIsRefused(): void
    {
        $this->upload('vide.pdf', '');
        self::assertResponseStatusCodeSame(422);
        self::assertSame('empty_file', $this->responseData()['code']);

        $this->client->request('POST', '/api/documents', server: ['HTTP_AUTHORIZATION' => 'Bearer '.$this->token]);
        self::assertResponseStatusCodeSame(422);
        self::assertSame('no_file', $this->responseData()['code']);
        $this->assertNothingKept();
    }

    public function testADocumentCanHaveAPillar(): void
    {
        $this->upload('duerp.pdf', self::PDF, ['domain' => 'safety']);
        self::assertResponseStatusCodeSame(201);
        self::assertSame('safety', $this->responseData()['domain']);

        $this->upload('duerp.pdf', self::PDF, ['domain' => 'finance']);
        self::assertResponseStatusCodeSame(422);
        self::assertSame('invalid_domain', $this->responseData()['code']);
    }

    public function testTheOriginalNameIsCleanedAndCut(): void
    {
        $this->upload("rap\x07port\x1f.pdf", self::PDF);
        self::assertResponseStatusCodeSame(201);
        self::assertSame('rap_port_.pdf', $this->responseData()['name']);

        $this->upload(str_repeat('é', 300).'.pdf', self::PDF);
        self::assertResponseStatusCodeSame(201);
        $name = $this->responseData()['name'];
        self::assertSame(255, mb_strlen($name));
        self::assertStringEndsWith('é.pdf', $name);
    }

    public function testTheListShowsOnlyTheOwnOrganizationLatestFirst(): void
    {
        $spyToken = $this->tokenInAnotherOrganization();

        $this->upload('secret-de-globex.pdf', self::PDF, token: $spyToken);
        $this->upload('premier.pdf', self::PDF);
        $this->upload('second.pdf', self::PDF);

        $this->getAs('/api/documents');

        self::assertResponseIsSuccessful();
        self::assertSame(['second.pdf', 'premier.pdf'], array_column($this->responseList(), 'name'));
    }

    public function testAnotherOrganizationsDocumentIsNeverFoundNorDeleted(): void
    {
        $spyToken = $this->tokenInAnotherOrganization();
        $id = $this->uploaded('duerp-acme.pdf', self::PDF);

        $this->getAs('/api/documents/'.$id.'/download', $spyToken);
        self::assertResponseStatusCodeSame(404);
        self::assertStringNotContainsString('%PDF', (string) $this->client->getInternalResponse()->getContent());

        $this->jsonAs('DELETE', '/api/documents/'.$id, token: $spyToken);
        self::assertResponseStatusCodeSame(404);

        self::assertCount(1, $this->storedFiles());
    }

    public function testAnonymousRequestsAreRefused(): void
    {
        $id = $this->uploaded('duerp.pdf', self::PDF);
        foreach (['/api/documents', '/api/documents/'.$id.'/download'] as $uri) {
            $this->client->request('GET', $uri);
            self::assertResponseStatusCodeSame(401);
        }
    }

    public function testAReaderConsultsAndDownloadsButNeverWrites(): void
    {
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $readerToken = $this->issueToken($reader);
        $id = $this->uploaded('duerp.pdf', self::PDF);

        $this->getAs('/api/documents', $readerToken);
        self::assertResponseIsSuccessful();
        $this->getAs('/api/documents/'.$id.'/download', $readerToken);
        self::assertResponseIsSuccessful();

        $this->upload('autre.pdf', self::PDF, token: $readerToken);
        self::assertResponseStatusCodeSame(403);
        $this->jsonAs('DELETE', '/api/documents/'.$id, token: $readerToken);
        self::assertResponseStatusCodeSame(403);
        self::assertCount(1, $this->storedFiles());
    }

    public function testTheDownloadCannotRunInTheBrowser(): void
    {
        $id = $this->uploaded('Procédure d\'évacuation.pdf', self::PDF);

        $this->getAs('/api/documents/'.$id.'/download');

        self::assertResponseIsSuccessful();
        self::assertSame(self::PDF, $this->client->getInternalResponse()->getContent());
        self::assertResponseHeaderSame('Content-Type', 'application/pdf');
        self::assertResponseHeaderSame('X-Content-Type-Options', 'nosniff');
        self::assertResponseHeaderSame('Content-Security-Policy', "default-src 'none'; sandbox");
        $disposition = (string) $this->client->getResponse()->headers->get('Content-Disposition');
        self::assertStringStartsWith('attachment;', $disposition);
        self::assertStringContainsString("filename*=utf-8''Proc%C3%A9dure", $disposition);
        self::assertStringContainsString('no-store', (string) $this->client->getResponse()->headers->get('Cache-Control'));
    }

    /**
     * @return iterable<string, array{string, string, string}>
     */
    public static function viewableFiles(): iterable
    {
        yield 'PDF' => ['duerp.pdf', self::PDF, 'application/pdf'];
        yield 'PNG' => ['plan.png', (string) base64_decode(self::PNG, true), 'image/png'];
        yield 'JPEG' => ['photo.jpg', self::jpeg(), 'image/jpeg'];
    }

    #[DataProvider('viewableFiles')]
    public function testPdfAndImagesAreShownInTheBrowser(string $name, string $content, string $type): void
    {
        $id = $this->uploaded($name, $content);

        $this->getAs('/api/documents/'.$id.'/view');

        self::assertResponseIsSuccessful();
        self::assertSame($content, $this->client->getInternalResponse()->getContent());
        self::assertResponseHeaderSame('Content-Type', $type);
        self::assertResponseHeaderSame('X-Content-Type-Options', 'nosniff');
        self::assertResponseHeaderSame('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'");
        self::assertStringStartsWith('inline;', (string) $this->client->getResponse()->headers->get('Content-Disposition'));
        self::assertStringContainsString('no-store', (string) $this->client->getResponse()->headers->get('Cache-Control'));
    }

    public function testATableIsNeverShownInTheBrowser(): void
    {
        foreach ([['registre.csv', "date;contrôle\n2026-11-05;extincteurs\n"], ['registre.xlsx', self::workbook()]] as [$name, $content]) {
            $id = $this->uploaded($name, $content);

            $this->getAs('/api/documents/'.$id.'/view');

            self::assertResponseStatusCodeSame(404);
            self::assertSame('not_viewable', $this->responseData()['code']);
        }
    }

    public function testAnotherOrganizationAndAnonymousVisitorsNeverSeeADocument(): void
    {
        $spyToken = $this->tokenInAnotherOrganization();
        $id = $this->uploaded('duerp-acme.pdf', self::PDF);

        $this->getAs('/api/documents/'.$id.'/view', $spyToken);
        self::assertResponseStatusCodeSame(404);
        self::assertStringNotContainsString('%PDF', (string) $this->client->getInternalResponse()->getContent());

        $this->client->request('GET', '/api/documents/'.$id.'/view');
        self::assertResponseStatusCodeSame(401);
    }

    public function testAReaderSeesADocument(): void
    {
        $reader = $this->createUser('lea@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Reader);
        $this->entityManager->flush();
        $readerToken = $this->issueToken($reader);
        $id = $this->uploaded('duerp.pdf', self::PDF);

        $this->getAs('/api/documents/'.$id.'/view', $readerToken);

        self::assertResponseIsSuccessful();
    }

    public function testAMissingFileIsNotFound(): void
    {
        $id = $this->uploaded('duerp.pdf', self::PDF);
        unlink($this->documentsFolder().'/'.$this->storedFiles()[0]);

        $this->getAs('/api/documents/'.$id.'/download');

        self::assertResponseStatusCodeSame(404);
    }

    public function testTheAuthorDeletesTheirDocumentAndItsFile(): void
    {
        $id = $this->uploaded('duerp.pdf', self::PDF);

        $this->jsonAs('DELETE', '/api/documents/'.$id);

        self::assertResponseStatusCodeSame(204);
        $this->assertNothingKept();
    }

    public function testOnlyTheAuthorOrAnAdministratorDeletes(): void
    {
        $colleague = $this->createUser('paul@acme.test', $this->organization);
        $admin = $this->createUser('admin@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();
        $colleagueToken = $this->issueToken($colleague);
        $adminToken = $this->issueToken($admin);
        $id = $this->uploaded('duerp.pdf', self::PDF);

        $this->jsonAs('DELETE', '/api/documents/'.$id, token: $colleagueToken);
        self::assertResponseStatusCodeSame(403);
        self::assertSame(DocumentController::DELETE_FORBIDDEN, $this->responseData()['error']);
        self::assertCount(1, $this->storedFiles());

        $this->jsonAs('DELETE', '/api/documents/'.$id, token: $adminToken);
        self::assertResponseStatusCodeSame(204);
        $this->assertNothingKept();
    }

    public function testTheDocumentStaysWhenItsAuthorLeaves(): void
    {
        $colleague = $this->createUser('paul@acme.test', $this->organization);
        $admin = $this->createUser('admin@acme.test', $this->organization)->setOrganizationRole(OrganizationRole::Admin);
        $this->entityManager->flush();
        $colleagueId = $colleague->getId();
        $colleagueToken = $this->issueToken($colleague);
        $adminToken = $this->issueToken($admin);
        $this->uploaded('duerp.pdf', self::PDF, $colleagueToken);

        $this->jsonAs('DELETE', '/api/users/'.$colleagueId, token: $adminToken);
        self::assertResponseStatusCodeSame(204);

        $this->getAs('/api/documents');
        self::assertNull($this->responseList()[0]['uploadedBy']);
        self::assertCount(1, $this->storedFiles());
    }

    /**
     * @param array<string, string> $fields
     */
    private function upload(string $name, string $content, array $fields = [], ?string $token = null): void
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'doc');
        file_put_contents($path, $content);
        $this->tempFiles[] = $path;

        $this->client->request(
            'POST',
            '/api/documents',
            $fields,
            ['file' => new UploadedFile($path, $name, null, null, true)],
            ['HTTP_AUTHORIZATION' => 'Bearer '.($token ?? $this->token)],
        );
    }

    private function uploaded(string $name, string $content, ?string $token = null): string
    {
        $this->upload($name, $content, token: $token);
        self::assertResponseStatusCodeSame(201);

        return (string) $this->responseData()['id'];
    }

    private function tokenInAnotherOrganization(): string
    {
        $globex = new Organization('Globex');
        $this->entityManager->persist($globex);

        return $this->issueToken($this->createUser('spy@globex.test', $globex));
    }

    private function assertNothingKept(): void
    {
        self::assertSame(0, (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM document'));
        self::assertSame([], $this->storedFiles());
    }

    private function documentsFolder(): string
    {
        $folder = static::getContainer()->getParameter('app.documents_dir');
        self::assertIsString($folder);

        return $folder;
    }

    /**
     * @return list<string>
     */
    private function storedFiles(): array
    {
        return array_values(array_diff((array) @scandir($this->documentsFolder()), ['.', '..']));
    }

    private function emptyDocumentsFolder(): void
    {
        foreach ($this->storedFiles() as $file) {
            unlink($this->documentsFolder().'/'.$file);
        }
    }

    private static function jpeg(): string
    {
        $image = imagecreatetruecolor(4, 4);
        ob_start();
        imagejpeg($image);

        return (string) ob_get_clean();
    }

    /**
     * @param array<string, string> $extra
     */
    private static function workbook(array $extra = []): string
    {
        return self::archive(['[Content_Types].xml' => '<Types/>', 'xl/workbook.xml' => '<workbook/>'] + $extra);
    }

    /**
     * @param array<string, string> $entries
     */
    private static function archive(array $entries): string
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'zip');
        $archive = new \ZipArchive();
        $archive->open($path, \ZipArchive::OVERWRITE);
        foreach ($entries as $name => $content) {
            $archive->addFromString($name, $content);
        }
        $archive->close();
        $content = (string) file_get_contents($path);
        unlink($path);

        return $content;
    }
}
