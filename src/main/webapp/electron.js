const fs = require('fs')
const path = require('path')
const url = require('url')
const electron = require('electron')
const {Menu: menu, shell} = require('electron')
const ipcMain = electron.ipcMain
const dialog = electron.dialog
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const log = require('electron-log')
const program = require('commander')
const flowio = require('./flowio/flowio')
const __DEV__ = process.env.NODE_ENV === 'development'
const DEFAULT_QUERY = {
	'test': __DEV__ ? 1 : 0,
	'db': 0,
	'gapi': 0,
	'od': 0,
	'gh': 0,
	'tr': 0,
	'picker': 0,
	'mode': 'device',
	'browser': 0,
	'appcache': 1,
	'libs':0,
	//'basics_file_path':path.join(app.getPath('userData'),'basics.xml'),
	'flowio_path':''
}
const DEFAULT_OFFLINE_QUERY = {
	'dev': __DEV__ ? 1 : 0,
	'drawdev': __DEV__ ? 1 : 0,
	'test': __DEV__ ? 1 : 0,
	'db': 0,
	'gapi': 0,
	'od': 0,
	'gh': 0,
	'tr': 0,
	'analytics': 0,
	'picker': 0,
	'mode': 'device',
	'browser': 0,
	'export': 'https://exp.draw.io/ImageExport4/export',
	'libs':0,
	'flowio_path':''
	//'basics_file_path':path.join(app.getPath('userData'),'basics.xml')
}

let windowsRegistry = []
function loadLocalLibrary(win, key, value){
	win.webContents.send('args-obj', {'args':{'llib':{key, value}}});
}

function loadLocalLibraries (win,query){
	let importlocallib=(key, value)=>loadLocalLibrary(win, key, value)
	flowio.importLibraryFlowio(importlocallib)
	if(query['flowio_path']){
		if(!Array.isArray(query['flowio_path'])) query['flowio_path']=[query['flowio_path']]
		query['flowio_path'].forEach((file_path)=>{
			flowio.importLocalLibraries(importlocallib, file_path, file_path, null)
			flowio.createFileIndex(file_path)
		})
	}
}

function getUserParams(must_query={}){
	let path_url_params = path.join(app.getPath('userData'),'urlParams.json')
	let query = {}
	if(!fs.existsSync(path_url_params)){
		query = DEFAULT_QUERY
		fs.writeFile(path_url_params, JSON.stringify(query), ()=>{})
		console.log('Written default user params')
	}else{
		urlparams = fs.readFileSync(path_url_params,'utf8')
		query = JSON.parse(urlparams)
	}
	if(!query['clibs']) query['clibs']=[]
	if(!Array.isArray(query['clibs'])) query['clibs']=[query['clibs']]
	return {...query,...must_query}
}

function createWindow (opt = {})
{
	let options = Object.assign(
	{
		width: 1600,
		height: 1200,
		nodeIntegration: false,
		webViewTag: false,
		'web-security': true,
		allowRunningInsecureContent: __DEV__,
		webPreferences: {
			// preload: path.resolve('./preload.js'),
		}
	}, opt)

	let mainWindow = new BrowserWindow(options)
	windowsRegistry.push(mainWindow)

	console.log('createWindow', opt)
	let query = getUserParams()
	let wurl = url.format(
	{
		pathname: `${__dirname}/index.html`,
		protocol: 'file:',
		query: query,
		slashes: true
	})
	mainWindow.loadURL(wurl)

	// Open the DevTools.
	if (__DEV__)//
	{
		mainWindow.webContents.openDevTools()
	}

	mainWindow.on('close', (event) =>
	{
		const win = event.sender
		const index = windowsRegistry.indexOf(win)
		console.log('Window on close', index)
		const contents = win.webContents

		if (contents != null)
		{
			contents.executeJavaScript('if(typeof global.__emt_isModified === \'function\'){global.__emt_isModified()}', true,
				isModified =>
				{
					console.log('__emt_isModified', isModified)
					if (isModified)
					{
						var choice = dialog.showMessageBox(
							win,
							{
								type: 'question',
								buttons: ['Cancel', 'Discard Changes'],
								title: 'Confirm',
								message: 'The document has unsaved changes. Do you really want to quit without saving?' //mxResources.get('allChangesLost')
							})

						if (choice === 1)
						{
							win.destroy()
						}
					}
					else
					{
						win.destroy()
					}
				})

			event.preventDefault()
		}
	})


	// Emitted when the window is closed.
	mainWindow.on('closed', (event/*:WindowEvent*/) =>
	{
		const index = windowsRegistry.indexOf(event.sender)
		console.log('Window closed idx:%d', index)
		windowsRegistry.splice(index, 1)
	})
	mainWindow.webContents.on('dom-ready',()=>{
		let query = getUserParams()
		loadLocalLibraries(mainWindow, query)
	})
	mainWindow.webContents.on('did-fail-load', function(err)
    {
			let query = getUserParams(DEFAULT_OFFLINE_QUERY)
			let ourl = url.format(
		{
			pathname: `${__dirname}/index.html`,
			protocol: 'file:',
			query:query,
			slashes: true,
		})

		mainWindow.loadURL(ourl)
    })

	return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', e =>
{
	//asynchronous
	ipcMain.on('asynchronous-message', (event, arg) =>
	{
		console.log(arg)  // prints "ping"
		event.sender.send('asynchronous-reply', 'pong')
	})
	//synchronous
	ipcMain.on('winman', (event, arg) =>
	{
		console.log('ipcMain.on winman', arg)

		if (arg.action === 'newfile')
		{
			event.returnValue = createWindow(arg.opt).id

			return
		}

		event.returnValue = 'pong'
	})

    let argv = process.argv
    // https://github.com/electron/electron/issues/4690#issuecomment-217435222
    if (process.defaultApp != true)
    {
        argv.unshift(null)
    }

    program
        .version(app.getVersion())
        .usage('[options] [file]')
        .option('-c, --create', 'creates a new empty file if no file is passed')
        .parse(argv)

    let win = createWindow()

    win.webContents.on('did-finish-load', function()
    {
        win.webContents.send('args-obj', program);

        win.webContents.setZoomFactor(1);
        win.webContents.setVisualZoomLevelLimits(1, 1);
        win.webContents.setLayoutZoomLevelLimits(0, 0);
    });

	let template = [{
	    label: app.getName(),
	    submenu: [
	      {
	        label: 'Website',
	        click() { shell.openExternal('https://about.draw.io'); }
	      },
	      {
	        label: 'Support',
	        click() { shell.openExternal('https://about.draw.io/support'); }
	      },
	      {
	        type: 'separator'
	      },
				{
	        label: 'flowio...',
	        click() { shell.openItem(app.getPath('userData')); }
	      },
				{
				 type: 'separator'
			 	},
	      {
	        label: 'Quit',
	        accelerator: 'CmdOrCtrl+Q',
	        click() { app.quit(); }
	      }]
	}]

	if (process.platform === 'darwin')
	{
	    template = [{
	      label: app.getName(),
	      submenu: [
	        {
	          label: 'About ' + app.getName(),
	          click() { shell.openExternal('https://about.draw.io'); }
	        },
	        {
	          label: 'Support',
	          click() { shell.openExternal('https://about.draw.io/support'); }
	        },
	        {
	          type: 'separator'
	        },
	        {
	          label: 'Quit',
	          accelerator: 'Command+Q',
	          click() { app.quit(); }
	        }
	      ]
	    }, {
	      label: 'Edit',
	      submenu: [{
	        label: 'Cut',
	        accelerator: 'CmdOrCtrl+X',
	        selector: 'cut:'
	      }, {
	        label: 'Copy',
	        accelerator: 'CmdOrCtrl+C',
	        selector: 'copy:'
	      }, {
	        label: 'Paste',
	        accelerator: 'CmdOrCtrl+V',
	        selector: 'paste:'
	      }]
	    }]
	}

	const menuBar = menu.buildFromTemplate(template)
	menu.setApplicationMenu(menuBar)
})

// Quit when all windows are closed.
app.on('window-all-closed', function ()
{
	console.log('window-all-closed', windowsRegistry.length)
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin')
	{
		app.quit()
	}
})

app.on('activate', function ()
{
	console.log('app on activate', windowsRegistry.length)
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (windowsRegistry.length === 0)
	{
		createWindow()
	}
})
