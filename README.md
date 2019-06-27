# Guia del desenvolupador - flowio

Aquesta és la guia per a desenvolupadors del repositori flowio. 

## Dependències 🚩

- `electron`
- `flowio-core`
  - `pako`
  - `lodash`
  - `xml2js`

## Instal·lació 💻

Per tal d'instal·lar-ho com a desenvolupador es necessiten les comandes `git`  i `npm` (Node.JS):

`git clone --recursive https://github.com/bernatesquirol/flowio-desktop.git`

`cd ./flowio-desktop`

`npm install`

`cd ./flowio`

`npm install`

`cd src/main/webapp/flowio-core`

`npm install`

Torna a l'arrel (`flowio-desktop`): `cd ../../../../..`

`npm start`

Les dependencies estan enllaçades a través de submòduls de git. La qual cosa quan es commita un submòdul, també s'ha de commitar el(s) mòdul(s) superior(s) (sinó, no canvia la referència al nou commit).

## Release 🗃

Es crea el release amb [electron-builder](https://www.electron.build/) i es fa corrent l'script:

`npm run-script release`

Per defecte crea la versió portable, la unpacked i la d'instal·lació.

## Mapa 🗺

Aquí es presenta el mapa del projecte, amb tots els repositoris involucrats.

![dev-dependencies-forks](.\doc\dev-dependencies-forks.png)

1. [drawio](https://github.com/jgraph/drawio) 

   L'eina en la qual es basa tot el projecte, serveix per fer diagrames en línia, és de codi obert i gratuïta. 

1. [drawio-desktop](https://github.com/jgraph/drawio-desktop)

   L'empaquetament oficial de la plataforma web usant [electron.js](https://electronjs.org/). Té com a submòdul l'aplicació drawio.

2. [flowio-core](https://github.com/bernatesquirol/flowio-core)

   On es troba el codi nou de tot el projecte: es divideix en `flowio.js` (la base del projecte) i `drawio-node.js` (api de javascript creada per interactuar amb els diagrames)

3. [flowio](https://github.com/bernatesquirol/flowio)

   És la versió de drawio, alterada per incorporar les modificacions del projecte. Els arxius modificats són `electron.js` (el punt d'entrada de l'aplicació) i `src/main/webapp/js/diagramly/ElectronApp.js` (el punt de comunicació de electron dins la aplicació web, és l'únic arxiu que no es compila en l'`app.min.js`, que no s'ha hagut de modificar). 

4. [flowio-desktop](https://github.com/bernatesquirol/flowio-desktop)

   És la versió de drawio-desktop, alterada per incorporar el canvi de submòdul (de drawio a flowio):`package.json` i `electron-builder.js`; així com el canvi de logo `build/icon.png` i `build/icon.ico`.

5. [flowio-docs](https://github.com/bernatesquirol/flowio-docs)

   Fa referència a una de les aplicacions construides sobre flowio, basada en [docsify](https://docsify.js.org/#/quickstart), crea una documentació a partir dels diagrames creats.



## Documentació 📖

La seqüència de crides de requeriments de flowio és `electron.js`$\rightarrow$ `ElectronApp.js`. També cal flowio-core.

#### `electron.js`

Desde aquí es controla l'start-up de l'aplicació que és on quasi tot es canvia modifica. Fa el paper de servidor en una aplicació web, però amb la possibilitat d'executar codi al client.

1. L'aplicació draw.io [permet canviar](https://desk.draw.io/support/solutions/articles/16000042546-what-url-parameters-are-supported-) alguns dels seus paràmetres a través de la query `GET` a la URL que es faci al iniciar l'aplicació, però drawio-desktop no ho permet. Amb flowio es poden canviar aquests paràmetres a través de l'arxiu `urlParams.json` situat a `$APPDATA$/urlParams.json` (es pot trobar també fent click al menú *flow.io* > *Change URL parameters*). Els paràmetres extres que incorpora flow.io (a més dels de draw.io):
   - `flowio_path` [⚠ REQUIRED!!]: és la ruta on guardarem tots els diagrames, perquè funcioni l'aplicació és necessari omplir-la, per defecte és null.
   - `clibs`: són llibreries de draw.io que es volen importar cada cop que s'obra l'aplicació, es pot modificar amb un String o una array
2. `electron.js` controla a més l'estat de l'aplicació. Els [esdeveniments](https://electronjs.org/docs/api/browser-window#instance-events) que emet el `BrowserWindow` (la finestra de navegador que fa servir electron per a mostrar la webapp) ens són útils per controlar el flux. En el cas de flowio ens interessa usar l'esdeveniment on `dom-ready` del `BrowserWindow.webcontents` per tal de carregar les llibreries, quan l'aplicació estigui preparada. Quan `dom-ready` carreguem totes les llibreries que necessitem: s'envia un objecte `args-obj` al client (`ElectronApp.js`) amb la llibreria preparada per ser carregada.

#### `ElectronApp.js`

Arxiu ja existent a drawio (`flowio-desktop\flowio\src\main\webapp\js\diagramly\ElectronApp.js`) que actua de client en l'aplicació, reb missatges del servidor i administra els recursos de diagramly i mxgraph (dependències de drawio). S'encarrega per exemple d'obrir un diagrama de l'ordinador. S'ha extès aquestes funcionalitats incorporant que quan es rebi un missatge desde servidor amb `args-obj` amb la clau `llib` (local library) es carregui aquesta llibreria. Aquesta llibreria ha d'estar en el format standard de `mxLibrary` :

```{XML}
<mxlibrary>
  [{"xml":"dVFBcoMwDHyN...", "title":"title"},...]
</mxlibrary>
```

El valor de xml ha d'estar comprimit utilitzant la llibreria `pako` tal com es fa a drawio.



## Bugs coneguts 🐛

1. (relacionat amb [flowio-core](https://github.com/bernatesquirol/flowio-core)) Fem servir com a clau de tots els arxius el seu diagram-id, i no el seu ino (identificador únic) per suportar el copy-paste i els canvis d'unitat. Això però té dos problemes:
   - Si s'arrossega un diagrama ja crear a l'aplicació, quan es guardi aquell diagrama li haurà creat una altra id, per tant podem tenir dos id que representin el mateix diagrama. Cal evitar aquest ús.
   - Si es té un diagrama i es vol crear un altre diagrama, i es borra tot i es torna a començar amb el full en blanc, la id serà la mateixa que l'altre diagrama. La solució de moment és que no es pot importar dos diagrames amb la mateixa id com a llibreria.
2. Té com a dependències les de flowio-core perquè sinó al compilat no les utilitza corretament

## Millores possibles ✅

1. Millorar el canvi de ruta de flowio_path
2. Incorporar links als fitxers original en cada un dels blocs
3. Suport a [mermeid.js](https://mermaidjs.github.io/)
4. Traducció a diferents idiomes
5. Prohibir drag-&-drop per evitar bug 1

