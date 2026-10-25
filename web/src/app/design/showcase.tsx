"use client";

import { CircleCheck, Info, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { DomainBadge } from "@/components/domain-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOMAIN_KEYS, DOMAINS } from "@/lib/domains";

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            {children}
        </section>
    );
}

export function Showcase() {
    return (
        <div className="flex flex-col gap-12">
            <Section title="Boutons">
                <div className="flex flex-wrap items-center gap-3">
                    <Button>
                        <Plus /> Action principale
                    </Button>
                    <Button variant="highlight">Mise en avant</Button>
                    <Button variant="secondary">Secondaire</Button>
                    <Button variant="outline">Contour</Button>
                    <Button variant="ghost">Discret</Button>
                    <Button variant="destructive">Supprimer</Button>
                    <Button variant="link">Lien</Button>
                    <Button size="icon" variant="outline" aria-label="Ajouter">
                        <Plus />
                    </Button>
                    <Button disabled>Désactivé</Button>
                </div>
            </Section>

            <Section title="Champ de saisie">
                <div className="flex max-w-md flex-col gap-2">
                    <label htmlFor="demo-email" className="text-sm font-medium">
                        Adresse e-mail
                    </label>
                    <Input
                        id="demo-email"
                        type="email"
                        placeholder="prenom.nom@entreprise.fr"
                    />
                    <label
                        htmlFor="demo-invalid"
                        className="mt-2 text-sm font-medium"
                    >
                        Champ en erreur
                    </label>
                    <Input
                        id="demo-invalid"
                        aria-invalid="true"
                        aria-describedby="demo-invalid-error"
                        defaultValue="valeur incorrecte"
                    />
                    <p id="demo-invalid-error" className="text-sm text-danger">
                        Saisissez une adresse e-mail valide.
                    </p>
                </div>
            </Section>

            <Section title="Badges">
                <div className="flex flex-wrap gap-2">
                    <Badge>Par défaut</Badge>
                    <Badge variant="secondary">Secondaire</Badge>
                    <Badge variant="outline">Contour</Badge>
                    <Badge variant="success">Terminé</Badge>
                    <Badge variant="warning">En cours</Badge>
                    <Badge variant="info">Nouveau</Badge>
                    <Badge variant="destructive">En retard</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                    {DOMAIN_KEYS.map((key) => (
                        <DomainBadge key={key} domain={key} />
                    ))}
                </div>
            </Section>

            <Section title="Cartes">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Carte standard</CardTitle>
                            <CardDescription>
                                Fond blanc, ombre légère
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-3xl font-semibold">
                            72
                        </CardContent>
                    </Card>
                    <Card tone="brand">
                        <CardHeader>
                            <CardTitle>Carte de marque</CardTitle>
                            <CardDescription>
                                Fond teal, texte blanc
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-3xl font-semibold">
                            +12
                        </CardContent>
                    </Card>
                    {DOMAIN_KEYS.map((key) => (
                        <Card key={key} tone={key}>
                            <CardHeader>
                                <CardTitle>{DOMAINS[key].label}</CardTitle>
                                <CardDescription>
                                    Teinte du domaine
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </Section>

            <Section title="Onglets">
                <Tabs defaultValue="all">
                    <TabsList>
                        <TabsTrigger value="all">Tout</TabsTrigger>
                        <TabsTrigger value="todo">À faire</TabsTrigger>
                        <TabsTrigger value="done">Terminé</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all">Contenu « Tout »</TabsContent>
                    <TabsContent value="todo">Contenu « À faire »</TabsContent>
                    <TabsContent value="done">Contenu « Terminé »</TabsContent>
                </Tabs>
                <Tabs defaultValue="quality">
                    <TabsList variant="line">
                        <TabsTrigger value="quality">Qualité</TabsTrigger>
                        <TabsTrigger value="hygiene">Hygiène-Santé</TabsTrigger>
                    </TabsList>
                </Tabs>
            </Section>

            <Section title="Alertes">
                <div className="flex max-w-2xl flex-col gap-3">
                    <Alert variant="info">
                        <Info />
                        <AlertTitle>Information</AlertTitle>
                        <AlertDescription>
                            Une nouvelle réglementation concerne votre secteur.
                        </AlertDescription>
                    </Alert>
                    <Alert variant="success">
                        <CircleCheck />
                        <AlertTitle>Diagnostic enregistré</AlertTitle>
                        <AlertDescription>
                            Vos réponses ont bien été sauvegardées.
                        </AlertDescription>
                    </Alert>
                    <Alert variant="warning">
                        <TriangleAlert />
                        <AlertTitle>Justificatif bientôt expiré</AlertTitle>
                        <AlertDescription>
                            Le registre de sécurité expire dans 15 jours.
                        </AlertDescription>
                    </Alert>
                    <Alert variant="destructive">
                        <TriangleAlert />
                        <AlertTitle>Une erreur est survenue</AlertTitle>
                        <AlertDescription>
                            Réessayez dans quelques instants.
                        </AlertDescription>
                    </Alert>
                </div>
            </Section>

            <Section title="Tableau">
                <Card className="py-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Domaine</TableHead>
                                <TableHead>Échéance</TableHead>
                                <TableHead>Statut</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>Mettre à jour le DUERP</TableCell>
                                <TableCell>
                                    <DomainBadge domain="safety" />
                                </TableCell>
                                <TableCell>12 nov. 2026</TableCell>
                                <TableCell>
                                    <Badge variant="warning">En cours</Badge>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    Trier les déchets d&apos;atelier
                                </TableCell>
                                <TableCell>
                                    <DomainBadge domain="environment" />
                                </TableCell>
                                <TableCell>30 nov. 2026</TableCell>
                                <TableCell>
                                    <Badge variant="success">Terminé</Badge>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Card>
            </Section>

            <Section title="Fenêtre de dialogue et notification">
                <div className="flex flex-wrap gap-3">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                Supprimer une action
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    Supprimer cette action ?
                                </DialogTitle>
                                <DialogDescription>
                                    Cette action sera définitivement supprimée
                                    du plan.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">Annuler</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                    <Button variant="destructive">
                                        Supprimer
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button
                        variant="secondary"
                        onClick={() =>
                            toast.success("Modifications enregistrées")
                        }
                    >
                        Afficher une notification
                    </Button>
                </div>
            </Section>

            <Section title="Fil d'Ariane">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href="#">
                                Tableau de bord
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Design system</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </Section>
        </div>
    );
}
