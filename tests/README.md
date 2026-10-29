Les tests ne se connectent pas à Supabase et ne créent aucun foyer.

- `npm test` (vitest) vérifie l'échéance T1 et l'absence de réveils périodiques inutiles, le tri de l'inventaire, ses lignes et la quantité modifiable dans la liste.
- Avec le serveur Vite lancé, ouvrir `/tests/browser.html`, déplier « Vérifications locales » et cliquer « Lancer les vérifications ».

Le banc navigateur utilise les composants réels avec des articles en mémoire. Il couvre le rangement, les gestes annulés, les suppressions et restaurations, les échéances, la promotion vers l'inventaire et ses deux actions (ajout à la liste, suppression), la conservation du défilement, les panneaux, les langues, les thèmes, les messages et la réduction des mouvements. Les préférences de langue et de thème sont restituées après la passe.

Pour le cochage/décochage, il échantillonne aussi le déplacement image par image : aucune animation d'entrée ne doit se relancer lors du changement de place, ni aucun voisin bouger avant le rangement. Ces cas incluent les noms longs et un écho serveur simulé.

Les panneaux Groupe et Réglages sont contrôlés depuis leur bouton réel : origine de la surface, position conservée de l'icône, flou arrêté au-dessus du socle, fermeture et retour du focus. Le classement est également essayé avec 18 membres, une ouverture interrompue et les mouvements réduits.

Le clavier logiciel doit aussi être essayé sur un iPhone réel : une fenêtre de bureau redimensionnée ne reproduit pas tous les événements VisualViewport de Safari.
