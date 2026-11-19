# Provare l'app su altri telefoni

_English: [TESTING.md](TESTING.md)_

L'app è online su **https://whatweplay.pages.dev**. Qualsiasi telefono con un browser può
aprirla: niente account, niente store. Questa pagina è la lista di controllo per gli amici che
la provano, più la parte del proprietario (condividere il link, pubblicare le correzioni).

## 1. Condividere il link

Manda il link e la guida all'installazione. Messaggio pronto da incollare:

> Prova la nostra app per i giochi da tavolo: https://whatweplay.pages.dev
> Aprila in Chrome/Firefox (Android) o Safari (iPhone), non dentro WhatsApp, e aggiungila alla
> schermata Home — istruzioni: https://github.com/gabripo/board-games-companion/blob/main/docs/INSTALL.it.md

Per passarla di persona, mostra un codice QR: in Chrome su un computer apri il link, poi menu
**⋮** › **Trasmetti, salva e condividi** › **Crea codice QR**, e fallo inquadrare con la
fotocamera del telefono.

## 2. Lista di controllo per chi prova (circa 10 minuti)

1. **Apri** il link nel browser del telefono (non nel browser interno di un'app di chat).
2. **Installala** sulla schermata Home — [INSTALL.it.md](INSTALL.it.md) — e da lì in poi
   aprila da quell'icona. Deve aprirsi a schermo intero, senza la barra degli indirizzi.
3. **Lingua:** scegline una, poi cambiala in ⚙ **Impostazioni**: tutto cambia all'istante.
4. **Ogni gioco** (BANG!, Horrified, Munchkin): aprilo, rispondi a "Hai già giocato a…?", poi
   guarda le quattro schede in basso — **Impara**, **Gioca**, **Plancia**, **Regole**.
   - Impara: tocca una scorciatoia (Preparazione, Icone e termini…): la sezione compare
     subito sotto la barra in alto.
   - Plancia: le immagini si caricano; allarga con due dita per lo zoom; tocca un'area
     evidenziata per vederne le regole.
   - Gioca: segui un turno con **Avanti**.
   - Regole: cerca una parola (es. "prigione", "beholder").
   - Tocca la riga sotto il titolo del gioco (giocatori · gioco base) e cambia il numero di
     giocatori o attiva un'espansione/un mostro: i contenuti si adattano.
5. **Offline:** in un gioco tocca **Scarica per l'uso offline** (consenti l'archiviazione se
   richiesto) e aspetta "Disponibile offline". Attiva la **modalità aereo**, chiudi del tutto
   l'app e riaprila dall'icona: quel gioco deve aprirsi lo stesso, con le immagini. I video
   possono dire che serve la connessione: è normale. Poi disattiva la modalità aereo.
6. **Schermo acceso:** lascia una guida aperta un paio di minuti senza toccarla; lo schermo
   non deve spegnersi.

## 3. Segnalare un problema

Manda al proprietario:

- modello del telefono e versione del sistema (es. _Pixel 7, Android 17_ / _iPhone 15, iOS 26_);
- browser (Chrome, Firefox, Samsung Internet, Safari) e se hai usato l'icona installata;
- il gioco, la scheda e cosa stavi facendo;
- uno screenshot (Android: accensione + volume giù; iPhone: tasto laterale + volume su).

## 4. Proprietario: pubblicare una correzione

1. Correggi, poi esegui `pnpm check` e `pnpm e2e`.
2. `pnpm deploy:pages` dal Mac (che ha le immagini private — vedi [DEPLOY.md](DEPLOY.md)).
3. Chi prova riceve la nuova versione da solo: l'app la scarica quando è online e la usa alla
   successiva apertura. Se qualcuno vede ancora la vecchia, chiude del tutto l'app e la riapre.

Per provare sul tuo telefono Android _prima_ di pubblicare (via Wi-Fi, senza caricare nulla),
usa i passaggi con `adb reverse` in [DEPLOY.md](DEPLOY.md#test-on-a-real-phone-first-no-deploy-needed).
Con l'iPhone non si può: provalo sul sito pubblicato.
