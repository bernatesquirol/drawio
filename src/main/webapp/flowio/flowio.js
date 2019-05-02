const fs = require('fs')
const path = require('path')
const drawionode = require('./drawio-node')
function importLocalLibraries(loadLocalLibrary, file_path, original_file_path, basics_file_path){
	if(fs.lstatSync(file_path).isFile()){
		let key_lib = path.basename(file_path)
		if (key_lib.slice(-4)=='.xml'){
			let result = fs.promises.readFile(file_path,'utf8').then((data)=>{
				return {'xml':{'key':key_lib, 'value':data}}
			})
			//console.log(result)
			return result
		}
		if (key_lib.slice(-7)=='.drawio'){
			let file_id = fs.lstatSync(file_path).ino
			let result = fs.promises.readFile(file_path,'utf8').then((data)=>{
				return drawionode.parseString(data).then((data_value)=>{
						let compressed = data_value['mxfile']['diagram'][0]._;
						return drawionode.parseString(drawionode.decompress(compressed),{'explicitChildren':true}).then((result_decompressed)=>{
							let inputs = drawionode.getClearLabels(drawionode.findChildren(result_decompressed, {'flowio_key':'input_func'}))
							let name_func = drawionode.getClearLabels(drawionode.findChildren(result_decompressed, {'flowio_key':'name_func'}))[0]
							let outputs = drawionode.getClearLabels(drawionode.findChildren(result_decompressed, {'flowio_key':'output_func'}))
							return drawionode.createMinimizedFunctionCell(basics_file_path,inputs, outputs, file_id, name_func).then((all_blocks)=>{
								let mxGraph = drawionode.getDiagram(all_blocks)
								let value = drawionode.compress(drawionode.toString(mxGraph,{headless:true}))
								return {'drawio':{'key':name_func?name_func:file_id, 'value':value}}
								
							}).catch((err)=>(console.log('hey',err)))

						}).catch((err)=>(console.log(err)))
				}).catch(()=>(console.log('ei2')))
			})
			return result
		}
	}else if(fs.lstatSync(file_path).isDirectory()) {
		return fs.promises.readdir(file_path).then((files)=>{
			return Promise.all(files.map((file)=>importLocalLibraries(loadLocalLibrary,path.join(file_path, file),original_file_path,basics_file_path))).then((array_of_data)=>{
				//console.log(array_of_data)
				let xmls = array_of_data.filter((obj)=>obj!=null&&Object.keys(obj)[0]=='xml')
				let drawios = array_of_data.filter((obj)=>obj!=null&&Object.keys(obj)[0]=='drawio')
				let folders = array_of_data.filter((obj)=>obj!=null&&Array.isArray(obj))
				xmls.forEach((xml_obj)=>{
					let key = xml_obj.xml.key
					let value = xml_obj.xml.value
					loadLocalLibrary(key, value)
				})
				if (drawios.length>0){
					let all_drawios_string = drawios.map((drawio_file)=>({"xml":drawio_file.drawio.value, "title":drawio_file.drawio.key,"w":80,"h":20,"aspect":"fixed"}))
					let value_drawios = '<mxlibrary>'+JSON.stringify(all_drawios_string)+'</mxlibrary>'
					let title_lib = path.relative(original_file_path, file_path)?path.relative(original_file_path, file_path):'./';
					loadLocalLibrary(title_lib, value_drawios)
				}
				//console.log(xmls.length, drawios.length, folders.length)
				return xmls.concat(drawios).concat(folders)
			})
		})
	}
}

const createSidebar=(file_path)=>{
    let name_of_file = file_path.match(/(?:[^\/\\](?!(\/|\\)))+$/gim)
    if (name_of_file==null) {name_of_file = "./"}
    else name_of_file = name_of_file[0]
    if(fs.lstatSync(file_path).isFile() && path.basename(file_path).slice(-3)=='.md'){
      return name_of_file
    }else if(fs.lstatSync(file_path).isDirectory()) {
      let files = fs.readdirSync(file_path)
      let return_obj = {}
      return_obj[name_of_file]=files.map((file)=>createSidebar(path.join(file_path, file))).filter((a)=>a!=null)
      if(return_obj[name_of_file].length==0) return null
      return return_obj
    }
  }
  
  const printSidebar=(sidebar,deep=1)=>{
    //console.log(sidebar)
    if (typeof sidebar === 'string') {return "-  "+sidebar+"("+sidebar+")"}
    let key = Object.keys(sidebar)[0]  
    //console.log(key,Array.isArray(sidebar[key]))
    let final_tema = sidebar[key].map((value)=>printSidebar(value, deep+1))
    //console.log(final_tema)
    let prefix ='\n'+'  '.repeat(deep)
    return key+prefix+(final_tema.join(separador=prefix))
  }

module.exports={
    importLocalLibraries: importLocalLibraries
}