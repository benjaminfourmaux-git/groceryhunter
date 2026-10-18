# Logo Huntly — style Grand ciel

`grand-ciel-encre-source.png` est le visuel validé : grande pomme inclinée,
flèche de teinte Encre (`#2A3A34`), chair jaune pâle et fond bleu dégradé.
Le carré opaque remplit le fichier ; les arrondis sont appliqués par iOS.

Créé avec l'outil intégré imagegen. Dernière consigne de retouche : remplacer
le vert de la flèche (empennage, tige et pointe) par Encre `#2A3A34`, en gardant
les inserts crème, la feuille verte, la pomme et le fond à l'identique.

Pour réexporter les PNG sur macOS : `sh scripts/export-icons.sh`.

- `public/apple-touch-icon.png` : 180 × 180, écran d'accueil iPhone.
- `public/app-icon-192.png` et `public/app-icon-512.png` : manifeste PWA,
  accueil et notifications.
- `public/favicon-16.png` et `public/favicon-32.png` : onglet du navigateur.

Le manifeste utilise `purpose: any` : ce dessin n'est pas prévu pour un masque
circulaire qui couperait l'empennage et la pointe de la flèche.
