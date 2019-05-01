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
const flowio = require('./flowio/drawio-node')
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
	'basics_file_path':path.join(app.getPath('userData'),'basics.xml'),
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
	'basics_file_path':path.join(app.getPath('userData'),'basics.xml')
}

let windowsRegistry = []
function loadLocalLibrary(win, key, value){
	win.webContents.send('args-obj', {'args':{'llib':{key, value}}});
}

function importLocalLibraries(win, file_path, original_file_path, query){
	if(fs.lstatSync(file_path).isFile()){
		let key_lib = path.basename(file_path)
		if (key_lib.slice(-4)=='.xml'){
			let result = fs.promises.readFile(file_path,'utf8').then((data)=>{
				//loadLocalLibrary(win, key_lib, data)
				return {'xml':{'key':key_lib, 'value':data}}
			})
			//console.log(result)
			return result
		}
		if (key_lib.slice(-7)=='.drawio'){
			let file_id = fs.lstatSync(file_path).ino
			let result = fs.promises.readFile(file_path,'utf8').then((data)=>{
				return flowio.parseString(data).then((data_value)=>{
						let compressed = data_value['mxfile']['diagram'][0]._;
						return flowio.parseString(flowio.decompress(compressed),{'explicitChildren':true}).then((result_decompressed)=>{
							let inputs = flowio.getClearLabels(flowio.findChildren(result_decompressed, {'flowio_key':'input_func'}))
							let name_func = flowio.getClearLabels(flowio.findChildren(result_decompressed, {'flowio_key':'name_func'}))[0]
							let outputs = flowio.getClearLabels(flowio.findChildren(result_decompressed, {'flowio_key':'output_func'}))
							return flowio.createMinimizedFunctionCell(query? query.basics_file_path:null,inputs, outputs, file_id, name_func).then((all_blocks)=>{
								let mxGraph = flowio.getDiagram(all_blocks)
								let value = flowio.compress(flowio.toString(mxGraph,{headless:true}))
								return {'drawio':{'key':name_func?name_func:file_id, 'value':value}}
								
							}).catch((err)=>(console.log('hey',err)))

						}).catch((err)=>(console.log(err)))
				}).catch(()=>(console.log('ei2')))
			})
			return result
		}
	}else if(fs.lstatSync(file_path).isDirectory()) {
		return fs.promises.readdir(file_path).then((files)=>{
			return Promise.all(files.map((file)=>importLocalLibraries(win,path.join(file_path, file),original_file_path,query))).then((array_of_data)=>{
				//console.log(array_of_data)
				let xmls = array_of_data.filter((obj)=>obj!=null&&Object.keys(obj)[0]=='xml')
				let drawios = array_of_data.filter((obj)=>obj!=null&&Object.keys(obj)[0]=='drawio')
				let folders = array_of_data.filter((obj)=>obj!=null&&Array.isArray(obj))
				xmls.forEach((xml_obj)=>{
					let key = xml_obj.xml.key
					let value = xml_obj.xml.value
					loadLocalLibrary(win, key, value)
				})
				if (drawios.length>0){
					let all_drawios_string = drawios.map((drawio_file)=>({"xml":drawio_file.drawio.value, "title":drawio_file.drawio.key,"w":80,"h":20,"aspect":"fixed"}))
					let value_drawios = '<mxlibrary>'+JSON.stringify(all_drawios_string)+'</mxlibrary>'
					let title_lib = path.relative(original_file_path, file_path)?path.relative(original_file_path, file_path):'./';
					loadLocalLibrary(win, title_lib, value_drawios)
				}
				//console.log(xmls.length, drawios.length, folders.length)
				return xmls.concat(drawios).concat(folders)
			})
		})
	}
}

function loadLocalLibraries (win,query){
	if(query['flowio_path']){
		if(!Array.isArray(query['flowio_path'])) query['flowio_path']=[query['flowio_path']]
		query['flowio_path'].forEach((file_path)=>{
			importLocalLibraries(win, file_path, file_path, query)
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
