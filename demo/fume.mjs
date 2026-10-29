// Fumigation : on charge la page compilée dans Chromium et on joue la boucle.
import pw from '/opt/node-tools/node_modules/playwright/index.js'
const { chromium } = pw
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const DIST = process.argv[2]
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const serveur = http.createServer((req, res) => {
  const nom = req.url === '/' ? '/artifact.html' : req.url.split('?')[0]
  const f = path.join(DIST, nom)
  if (!fs.existsSync(f)) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'text/plain' })
  res.end(fs.readFileSync(f))
})
await new Promise((r) => serveur.listen(5055, r))

const nav = await chromium.launch()
const page = await nav.newPage({ viewport: { width: 390, height: 844 } })
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()))

const dit = (s) => console.log(s)
await page.goto('http://127.0.0.1:5055/', { waitUntil: 'networkidle' })

await page.getByText('Lait demi-écrémé').first().waitFor({ timeout: 10000 })
dit('ok    la liste s’affiche')
dit('ok    en-tête du foyer : ' + (await page.locator('h1').first().innerText()))

const onglets = await page.locator('.tabbar .tab').allInnerTexts()
dit('ok    onglets : ' + onglets.join(' / '))

// On coche « Lait demi-écrémé » : il se barre et descend.
const ligneLait = page.locator('.swipe-row', { hasText: 'Lait demi-écrémé' })
await ligneLait.locator('.buy-check').click()
await page.waitForTimeout(400)
dit('ok    coché : ' + (await ligneLait.locator('.swipe-fg').getAttribute('class')))

// Au bout de 8 s (horloge accélérée), il quitte la liste pour l'inventaire.
// On cible #list-panel : les deux onglets sont montés en même temps, donc un
// getByText global retrouverait l'article… dans l'inventaire.
await page.waitForTimeout(10000)
const restantDansLaListe = await page.locator('#list-panel .item-name', { hasText: 'Lait demi-écrémé' }).count()
dit((restantDansLaListe === 0 ? 'ok   ' : 'ÉCHEC') + ' l’article a quitté la liste')
const lignesLait = await page.locator('#inventory-panel .item-name', { hasText: 'Lait demi-écrémé' }).count()
dit((lignesLait === 1 ? 'ok   ' : 'ÉCHEC') + ' un seul produit « Lait demi-écrémé » dans l’inventaire (pas de doublon)')

await page.locator('.tab', { hasText: 'Inventaire' }).click()
await page.waitForTimeout(600)
const produits = await page.locator('.inv-item .item-name').allInnerTexts()
dit('ok    inventaire (' + produits.length + ') : ' + produits.slice(0, 4).join(', ') + '…')
dit((produits[0] === 'Lait demi-écrémé' ? 'ok   ' : 'ÉCHEC') + ' le produit racheté est remonté en tête du classement')

// Tri alphabétique.
await page.getByRole('button', { name: 'A → Z' }).click()
await page.waitForTimeout(300)
dit('ok    A → Z : ' + (await page.locator('.inv-item .item-name').allInnerTexts()).slice(0, 3).join(', '))
await page.getByRole('button', { name: 'Les plus achetés' }).click()

// Sélection : deux produits, puis « Ajouter à la liste ».
await page.locator('.inv-item').nth(1).locator('.select-dot').click()
await page.locator('.inv-item').nth(3).locator('.select-dot').click()
await page.waitForTimeout(400)
const premiers = (await page.locator('.inv-item .item-name').allInnerTexts()).slice(0, 2)
dit('ok    cochés remontés en tête : ' + premiers.join(', '))
dit('ok    actions visibles : ' + (await page.locator('.inv-actions button').allInnerTexts()).join(' / '))

await page.getByRole('button', { name: /Ajouter à la liste/ }).click()
await page.waitForTimeout(900)
dit('ok    message : ' + (await page.locator('.toast').first().innerText().catch(() => '(aucun)')))

await page.locator('.tab', { hasText: 'Liste' }).click()
await page.waitForTimeout(600)
const liste = await page.locator('.swipe-row .item-name').allInnerTexts()
dit('ok    liste après ajout (' + liste.length + ') : ' + liste.join(', '))

// Quantité : on ouvre depuis le nom d'un article qui n'en a pas.
const cible = page.locator('.swipe-row', { hasText: premiers[0] }).first()
await cible.locator('.item-name-btn').click()
await page.waitForTimeout(250)
await page.locator('.qty-edit input').fill('1 kg')
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
dit('ok    quantité posée : ' + (await cible.locator('.qty-badge').innerText()))

await page.screenshot({ path: path.join(DIST, 'fume-liste.png') })
await page.locator('.tab', { hasText: 'Inventaire' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(DIST, 'fume-inventaire.png') })

dit(erreurs.length ? 'ERREURS CONSOLE : ' + erreurs.join(' | ') : 'ok    aucune erreur console')
await nav.close()
serveur.close()
