const fs = require('fs')
const path = require('path')
const drawionode = require('./drawio-node')
const _ = require('lodash');
const ROOT_ID = 1
/*
 **********************
 *** Create content ***
 **********************
*/


/**
 * Gets basics: mxObject (simple bloc): includes
 *  container (container)
 *  small input (input_func)
 *  small output (output_func)
 *  function (function)
 *  @return {String} compressed library
 */
const getBasics = ()=>{
	// at the end of the file
  return basics
}

/**
 * flowio lib contains the standard database/study/function diagrams
 * */
const importLibraryFlowio=(loadLocalLibrary)=>{
	// at the end of the file
	loadLocalLibrary('flowio', flowio_lib)
}

/**
 * Returns ids for the blocks 
 * XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 *  @return {String} id
 */
const guidGenerator = ()=>{
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4());
}

/**
 * creates the minimized function cell
 * @param  {Array[String]} inputs list of input parameters names
 * @param  {Array[String]} outputs list of output parameters names
 * @param  {String} flowio_id VERY IMPORTANT: the index has to be created with these (diagram id's)
 * @param  {String} mxCell_func_style Style
 * @param  {Int} top_padding padding inside the function (top)
 * @param  {Int} padding_side padding inside the function (sides)
 * @return {Array[mxObject]} all small blocks and the function
 */
const createMinimizedFunctionCell = (inputs, outputs, flowio_id, function_name, mxCell_func_style=null, top_padding=10, padding_side=20)=>{
	let basics_lib = getBasics()//createMinimizedFunctionCell
	// get the building blocks
	let function_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'function')
  let input_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'input')
	let output_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'output')
	return Promise.all([function_promise,input_promise,output_promise]).then(function(result){
			let real_func_id = flowio_id//'function'-guidGenerator()
			//function_id+'-function-'+Date.now()
			let func = result[0][0]
			let geo_func = func.getGeometry()
			let input = result[1][0]
			let geo_input = input.getGeometry()
			let output = result[2][0]
			let geo_output = output.getGeometry()
			// modify blocks position & name
			let input_blocks = inputs.map((input_text, index)=>(drawionode.modifySimpleBlock(block_o=input,id=guidGenerator(),id_parent=real_func_id, input_text, x=padding_side, y=index*(Number(geo_input.height)+top_padding)+top_padding)))
			let output_blocks = outputs.map((output_text, index)=>(drawionode.modifySimpleBlock(block_o=output,id=guidGenerator(),id_parent=real_func_id, output_text, x=2*padding_side+Number(geo_input.width), y=index*(Number(geo_output.height)+top_padding)+top_padding)))
			// change style
			if(mxCell_func_style) func.changeStyle(mxCell_func_style)
			let func_block = drawionode.modifySimpleBlock(func,id=real_func_id, id_parent=ROOT_ID, function_name, x=null, y=null, width=Number(geo_output.width)+Number(geo_input.width)+3*padding_side, height=(Number(geo_output.height)+top_padding)*Math.max(inputs.length, outputs.length)+top_padding, flowio_id=flowio_id)
			return [func_block].concat(input_blocks).concat(output_blocks)
	})
}

/**
 * Gets shape of object INSIDE 'flowio_key':'shape_container' 
 * (has to be related by parent=$shape_container.id)
 * @param  {mxObject} xml_obj the graph where shape_container is
 * @return {String?} style of the shape: the shape itself is not mxObject
 */
const getShapeStyle=(xml_obj)=>{
	let shapes = xml_obj.findChildrenRecursiveObjectFilter({'flowio_key':'shape_container'})
	let shape = null
	if(shapes.length>0){
		let id_parent = shapes[0].object.$.id
		let find_shapes = xml_obj.findChildrenRecursiveObjectFilter({'parent':id_parent})
		if(find_shapes.length>0){
			shape = find_shapes[0]//.mxCell
			return shape.mxCell.$.style
		}
	}
}

/**
 * Gets the function blocks from a given diagram (library)
 * (has to be related by parent=$shape_container.id)
 * @param  {mxObject} diagram the graph where shape_container is
 * @return {Array[mxObject]} all mxObjects 
 */
const importFunction=(diagram, file_id)=>{
	let shape_style = getShapeStyle(diagram)
	let inputs = drawionode.getClearLabels(diagram.findChildrenRecursiveObjectFilter({'flowio_key':'input_func'}))
	let name_func = drawionode.getClearLabels(diagram.findChildrenRecursiveObjectFilter({'flowio_key':'name'}))[0]
	let outputs = drawionode.getClearLabels(diagram.findChildrenRecursiveObjectFilter({'flowio_key':'output_func'}))
	return createMinimizedFunctionCell(inputs, outputs, file_id, name_func, shape_style).then((all_blocks)=>( {'blocks':all_blocks,'name':name_func}))
}

/**
 * Gets block: database / study from a given diagram
 * (has to be related by parent=$shape_container.id)
 * @param  {mxObject} diagram the graph where shape_container is
 * @param  {mxObject} file_id VERY IMPORTANT: indexed
 * @param  {mxObject} flowio_key database or study
 * @return {String?} style of the shape: the shape itself is not mxObject
 * 
 */
const importBlock=(diagram, file_id, flowio_key)=>{
	let basics_lib = getBasics()
	let function_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'function')
	let name = drawionode.getClearLabels(diagram.findChildrenRecursiveObjectFilter({'flowio_key':'name'}))[0]
  let shape_style = getShapeStyle(diagram)
	return function_promise.then((data)=>{
		let func = data[0]
		if(shape_style) func.changeStyle(shape_style)
    func.object.$.flowio_key=flowio_key
		let func_block = drawionode.modifySimpleBlock(func,id=file_id, id_parent=ROOT_ID, name, null, null,null,null, flowio_id=file_id)
		return {'blocks':func_block,'name':name}
	})
}

/**
 * Is the diagram a database
 * @param  {mxObject} diagram the graph where shape_container i
 * */
const isDatabase = (diagram)=>{
	return diagram.findChildrenRecursiveObjectFilter({'flowio_key':'type_database'}).length>0
}

/**
 * Is the diagram a function
 * @param  {mxObject} diagram the graph where shape_container i
 * */
const isFunction = (diagram)=>{
	return diagram.findChildrenRecursiveObjectFilter({'flowio_key':'type_function'}).length>0
}

/**
 * Is the diagram a study
 * @param  {mxObject} diagram the graph where shape_container i
 * */
const isStudy = (diagram)=>{
	return diagram.findChildrenRecursiveObjectFilter({'flowio_key':'type_study'}).length>0
}

const getDuplicateIds=(original_path)=>{
	let index = createFlowioIndexArray(original_path)
	return index.then((item)=>{
		let groupby = _.groupBy(item,Object.keys)
		let return_val = Object.keys(groupby).reduce((acc,file_id)=>{
			if (groupby[file_id].length<=1) return acc
			let paths = groupby[file_id].map((item)=>item[file_id])
			paths = paths.sort((path_a,path_b)=>{ //{ aI8DmJniFy8GYhdvDRHG: 'C:\\Users\\bernat\\PDU\\diagrames\\cosetes\\funcio4.drawio' }
				return fs.statSync(path_a).birthtimeMs - fs.statSync(path_b).birthtimeMs
			})			
			return [...acc,...paths.slice(1)]
		},[])
		return return_val
	})
	
}

/**
 * Gets all local diagrams as a libraries (recursively): async
 * @param  {function} loadLocalLibrary the function that really loads the library to drawio
 * @param  {String} file_path all path: directory or drawio file
 * @param  {String} original_file_path the original path
 * @returns {Promise} when its finished will be resolved
 * */
const importLocalLibraries = (loadLocalLibrary, file_path, original_file_path, avoid_paths=[])=>{
	if(fs.lstatSync(file_path).isFile()){
		let key_lib = path.basename(file_path)
		if (key_lib.slice(-4)=='.xml'){
			let result = fs.promises.readFile(file_path,'utf8').then((data)=>{
				return {'xml':{'key':key_lib, 'value':data}}
			})
			return result
		}
		if (key_lib.slice(-7)=='.drawio'){
			let result = drawionode.readDiagram(file_path).then((read_diagram_obj)=>{
        let diagram = read_diagram_obj['diagram']
				let file_id = read_diagram_obj['id']//fs.lstatSync(file_path).ino
				if (avoid_paths.includes(file_path)){ 
					return
				}
				let xml_data = null
				if (isFunction(diagram)){
					xml_data = importFunction(diagram,file_id)
				}else if (isStudy(diagram)){
					xml_data = importBlock(diagram, file_id, 'study')
					//let id = diagram.findChildrenRecursiveObjectFilter( {'flowio_key':'database_modified'})[0].object.$.id
				}else if (isDatabase(diagram)){
					xml_data = importBlock(diagram, file_id, 'database')
				}
				if(xml_data!=null){
					return xml_data.then((data)=>{
						let all_blocks = data['blocks']
						let name_func = data['name']
						let mxGraph = drawionode.getDiagram(all_blocks, ROOT_ID)
						let value = drawionode.compress(drawionode.toString(mxGraph,{headless:true}))
						return {'drawio':{'key':name_func?name_func:file_id, 'value':value}}

					}).catch((err)=>(console.log(err)))
				}
			}).catch((err)=>(console.log(err)))
			return result
		}
	}else if(fs.lstatSync(file_path).isDirectory()) {	
		return fs.promises.readdir(file_path).then((files)=>{
			return Promise.all(files.map((file)=>importLocalLibraries(loadLocalLibrary,path.join(file_path, file),original_file_path, avoid_paths))).then((array_of_data)=>{
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
				return xmls.concat(drawios).concat(folders)
			})
		})
	}
}

const importLocalLibrariesWithoutDuplicates=(loadLocalLibrary, file_path)=>{
	return getDuplicateIds(file_path).then((duplicates)=>{
		return importLocalLibraries(loadLocalLibrary, file_path, file_path, duplicates)
	})	
}
/*
 *************************
 *** Visualize content ***
 *************************
*/

/**
 * Gets a dictionary of ids and paths
 * @param {String} original_path the root of flowio
 * @param {String} added_path to dir or to .drawio file
 * @return {Object} {id_diagram: path}
 */
const createFlowioIndex=(original_path, added_path='./')=>{
  let file_path = path.join(original_path,added_path)
  let lstat = fs.lstatSync(file_path)
  if(lstat.isDirectory()){
    return fs.promises.readdir(file_path).then((files)=>{
      return Promise.all(files.map((file)=>{
        return createFlowioIndex(original_path, path.join(added_path,file))
      })).then((all_tal)=>{
        return all_tal.flat().reduce((obj,item)=>{
          obj = {...obj,...item}
          return obj
        },{});
      })
    })
  }else if(lstat.isFile() && file_path.slice(-7)=='.drawio'){
    let diagram_obj = drawionode.readDiagram(file_path)
    let file_id = drawionode.getDiagramId(file_path)
    //console.log('file',file_id)
    let return_val = {}
    return_val[file_id]=file_path
    return return_val
  }
}

/**
 * Gets a dictionary of ids and paths
 * @param {String} original_path the root of flowio
 * @param {String} added_path to dir or to .drawio file
 * @return {Object} {id_diagram: path}
 */
const createFlowioIndexArray=(original_path, added_path='./')=>{
  let file_path = path.join(original_path,added_path)
  let lstat = fs.lstatSync(file_path)
  if(lstat.isDirectory()){
    return fs.promises.readdir(file_path).then((files)=>{
      return Promise.all(files.map((file)=>{
        return createFlowioIndexArray(original_path, path.join(added_path,file))
      })).then((all_tal)=>{
        return all_tal.flat().reduce((arr,item)=>{
         	return [...arr,item]
        },[]).filter((item)=>item!=null);
      })
    })
  }else if(lstat.isFile() && file_path.slice(-7)=='.drawio'){
    let diagram_obj = drawionode.readDiagram(file_path)
    let file_id = drawionode.getDiagramId(file_path)
    //console.log('file',file_id)
    let return_val = {}
    return_val[file_id]=file_path
    return return_val
  }
}

/**
 * Creates the index and saves it to the root
 * @param {String} original_path the root path where the .flowio will be written
 */
const createFileIndex=(original_path)=>{
  return createFlowioIndex(original_path).then((result)=>{
    fs.writeFile(path.join(original_path,'.flowio'), JSON.stringify(result, null, 2), (err)=>{
		})
		return result
  })
}
/**
 * Gets the index dictionary
 * @param {String} original_path 
 */
const getFileIndex=(original_path)=>{
  return fs.promises.readFile(path.join(original_path,'.flowio')).then((data)=>JSON.parse(data))
}
/**
 * Creates the full graph given a file_id
 * @param {Object} index relates ids with paths
 * @param {String} file_id id of what we want the 'logic' from
 * @param {Boolean} extract_func whether we want to explore functions
 * @param {Boolean} extract_studies whether we want to explore studies
 * @param {Int} max_depth max depth we want to go
 * @param {Object} already_explored recursive use
 * @param {Int} depth recursive use
 * @param {String} root_id recursive use
 * @param {Int} x recursive use
 * @param {Int} y recursive use
 * @param {Int} padding_top Padding between functions
 */
const extractLogicFromFunction=(index, file_id, extract_func=true, extract_studies=true, max_depth=null, already_explored={}, depth=0, root_id=ROOT_ID, x=0, y=0, padding_top=20)=>{
	let basics_lib = getBasics()
	let promise_container = drawionode.getSimpleBlockFromLibrary(basics_lib, 'container')  
  if (Object.keys(already_explored).includes(file_id)) return null
  return drawionode.readDiagram(index[file_id]).then((read_diagram_obj)=>{
    let diagram = read_diagram_obj['diagram']
		let input_ids = {}
		let output_ids = {}
		let new_id_parent = guidGenerator()
		new_already_explored={...already_explored}
		new_already_explored[file_id]=new_id_parent
		let title = drawionode.getClearLabels(diagram.findChildrenRecursiveObjectFilter( {'flowio_key':'name'}))[0]
		let all_blocks = []
		if (isStudy(diagram)) {
			let databases = diagram.findChildrenRecursiveObjectFilter({'flowio_key':'database'})
			let databases_modified = diagram.findChildrenRecursiveObjectFilter({'flowio_key':'database_modified'})
			all_blocks=[...databases, ...databases_modified]
		} else if (isFunction(diagram)) {
			let input_cells = diagram.findChildrenRecursiveObjectFilter({'flowio_key':'input_func'})
			let output_cells = diagram.findChildrenRecursiveObjectFilter({'flowio_key':'output_func'})
			all_blocks=[...input_cells, ...output_cells]
		}
		let studies_small = diagram.findChildrenRecursiveObjectFilter({'flowio_key':'study'})
		let function_cells_small = diagram.findChildrenRecursiveObjectFilter({'flowio_key':'function'})
		all_blocks=[...all_blocks, ...function_cells_small, ...studies_small]

    let input_cells_small = diagram.findChildrenRecursiveObjectFilter({'flowio_key':'input'})
		let output_cells_small = diagram.findChildrenRecursiveObjectFilter({'flowio_key':'output'})
		let children_of_all_blocks = [...input_cells_small,...output_cells_small]
    let x_min = all_blocks.reduce((acc,item)=>{
      let new_x = parseInt(item.object.mxCell[0].mxGeometry[0].$.x)
      if (new_x<acc) return new_x
      return acc
    },Number.MAX_SAFE_INTEGER)
    let y_min = all_blocks.reduce((acc,item)=>{
      let new_x = parseInt(item.object.mxCell[0].mxGeometry[0].$.y)
      if (new_x<acc) return new_x
      return acc
    },Number.MAX_SAFE_INTEGER)
    let x_max = all_blocks.reduce((acc,item)=>{
      let new_x = parseInt(item.object.mxCell[0].mxGeometry[0].$.x)+parseInt(item.object.mxCell[0].mxGeometry[0].$.width)
      if (new_x>acc) return new_x
      return acc
    },0)
    let y_max = all_blocks.reduce((acc,item)=>{
      let new_x = parseInt(item.object.mxCell[0].mxGeometry[0].$.y)+parseInt(item.object.mxCell[0].mxGeometry[0].$.height)
      if (new_x>acc) return new_x
      return acc
		},0)

		let width_total =  x_max-x_min
		let height_total =  padding_top+y_max-y_min
		
		//cascade of function promises		
		let extract_logic_promises = []
		if(max_depth==null || depth<max_depth){
			let cells_to_extract = []
			if (extract_func)cells_to_extract=[...cells_to_extract, ...function_cells_small]
			if (extract_studies) cells_to_extract=[...cells_to_extract,...studies_small]
			extract_logic_promises = cells_to_extract.reduce((acc,func)=>{
				if (acc.length==0){
					return [extractLogicFromFunction(index,func.object.$.flowio_id, extract_func, extract_studies, max_depth, new_already_explored,	depth+1,ROOT_ID,x, y+height_total+padding_top)]
				}
				return [...acc,(acc[acc.length-1].then((result)=>{
					let x_func = result['x']
					let y_func = result['y']
					let width = result['width']
					let new_new_already_explored = result['already_explored']

					let return_val =  extractLogicFromFunction(index,func.object.$.flowio_id, extract_func, extract_studies, max_depth, new_new_already_explored, depth+1,ROOT_ID,x_func+width, y_func)
					return return_val
				}))].filter((item)=>item!=null)
			},[])
		}
    return Promise.all([...extract_logic_promises,promise_container]).then((all_promises_results)=>{
      all_promises_results = all_promises_results.filter((item)=>item!=null)
      let container = all_promises_results[all_promises_results.length-1]
			let all_func = all_promises_results.slice(0,all_promises_results.length-1)
			let container_modified = drawionode.modifySimpleBlock(container[0], new_id_parent, root_id, title, x, y, width_total, height_total)
      all_blocks = all_blocks.map((item, index)=>{
        let geo = item.getGeometry()
      	return drawionode.modifySimpleBlock(item,null,new_id_parent,null,geo.x-x_min,padding_top+geo.y-y_min)
      })
			let edges = drawionode.findEdges(diagram, [...all_blocks,...children_of_all_blocks])
				.map((item)=>{
          let new_edge = drawionode.removeEdgePoints(item)
          //canviar style dels edges
          let style = new_edge.getStyle()
          let find_edgeStyle = /edgeStyle=.*;/g
          let new_style = style.replace(find_edgeStyle, '')
          new_edge.changeStyle(new_style)
          return new_edge
        })
			let all_func_blocks = all_func.flatMap((item)=>item.blocks)
			let all_blocks_to_return = [...edges,container_modified,...all_func_blocks,...all_blocks,...children_of_all_blocks]
				.sort((a,b)=>{
					//edges per sobre
					if(a._isEdge) return 1
					else return 0
				})
      return {'title':title,'x':x,'y':y,'width':width_total, 'height':height_total,'blocks':all_blocks_to_return, 'already_explored':new_already_explored}
    })

	})
}

const extractLogicFromFile=(index,path)=>{
	let paths_x_id = _.invert(index)
	if (!paths_x_id[path]) return
  return extractLogicFromFunction(index, paths_x_id[path]).then((func_extraction)=>{
		let all_blocks = func_extraction['blocks']
		let mxGraph = drawionode.getDiagram(all_blocks, ROOT_ID)
		return {'data':drawionode.toString(mxGraph,{headless:true}),'name':func_extraction['title']+'-expanded.flowio'}
  })

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
  if (typeof sidebar === 'string') {return "-  "+sidebar+"("+sidebar+")"}
  let key = Object.keys(sidebar)[0]
  let final_tema = sidebar[key].map((value)=>printSidebar(value, deep+1))
  let prefix ='\n'+'  '.repeat(deep)
  return key+prefix+(final_tema.join(separador=prefix))
}

const createMdFile = (index, file_id)=>{
	if (!index[file_id]) return
	return drawionode.readDiagram(index[file_id]).then((read_diagram_obj)=>{
    let diagram = read_diagram_obj['diagram']
		let title = drawionode.getClearLabels(diagram.findChildrenRecursiveObjectFilter( {'flowio_key':'name'}))[0]
		let description =drawionode.getClearLabels(diagram.findChildrenRecursiveObjectFilter( {'flowio_key':'description'}))[0]
		if (isStudy(diagram)){

		}else if (isDatabase(diagram)){

		}else if (isFunction(diagram)){

		}
		return `## ${title} {${file_id}}
		${description}`
	})
}
function createDocumentation(index, file_path, flowio_path, depth=1){
	if (path.basename(file_path)[0]=='_') return
	if(!fs.existsSync(path.join(flowio_path,'./_docs'))) fs.mkdirSync(path.join(flowio_path,'./_docs'));
	if(!fs.existsSync(path.join(flowio_path,'./_docs/README.md'))) fs.writeFileSync(path.join(flowio_path,'./_docs/README.md'),'docs');
	if(depth>100) return
	if(fs.lstatSync(file_path).isFile()){
		let key_lib = path.basename(file_path)
		if (key_lib.slice(-7)=='.drawio'){
			let file_id = fs.lstatSync(file_path).ino
			return createMdFile(index,file_id).then((data)=>{
				let path_without_extension = file_path.slice(0,-7)
				let path_file = path.relative(flowio_path,path_without_extension)
				let new_file = path.join(flowio_path,'./_docs',path_file)+'.md'
				return fs.promises.writeFile(new_file, data)
			})
		}
	}else if(fs.lstatSync(file_path).isDirectory()) {
		let relative_folder = path.relative(flowio_path,file_path)
		if(!fs.existsSync(path.join(flowio_path,'./_docs', relative_folder))) fs.mkdirSync(path.join(flowio_path,'./_docs', relative_folder));
		if(!fs.existsSync(path.join(flowio_path,'./_docs', relative_folder, './README.md'))) fs.writeFileSync(path.join(flowio_path,'./_docs', relative_folder, './README.md'),'docs');
		return fs.promises.readdir(file_path).then((files)=>{
			return Promise.all(files.map((file)=>createDocumentation(index,path.join(file_path, file),flowio_path, depth+1)))
		})
	}
}

module.exports={
		//importLocalLibraries: importLocalLibraries,
		importLocalLibrariesWithoutDuplicates:importLocalLibrariesWithoutDuplicates,
		importLibraryFlowio:importLibraryFlowio,
    createFileIndex:createFileIndex,
		getFileIndex:getFileIndex,
		extractLogicFromFile:extractLogicFromFile,
		extractLogicFromFunction:extractLogicFromFunction,
		createMdFile:createMdFile,
		createDocumentation:createDocumentation,
		getDuplicateIds:getDuplicateIds
}
const basics = '<mxlibrary>[{"xml":"dVJNc4IwEP01HO1AouC1QvXSnjz02ImwSGpgaQgF++u7CUF0pj0w7Mt7efuRDXhajwct2uoNC1ABfwl4qhHNFNVjCkoFLJRFwLOAsZC+gO3/YSPHhq3Q0Jg/LuDpE3JDCiVONlnmyFiRdldiY5nOXBU4Jv7qcSZWnfyh02cSRKwdF5Kis/snOyMN3Uyy2ZCyTp5e4UorFQ4SPy5wnbLLpu3NRM1NMAsf+1uKYhr7pgArDcl0qKSBYytyyw40RjqrTG1bi3zpe1FLZbO99rksBLml2HRo/Rx/dJ1l0ZawUPLcEMhpfKDpoDMaL5CiQu3S8yI+xZv4xrzLwlRzMqnUnbIsS5bnt8a/QRsY/32m6K7pA2ANRl9J4i+wJ5bwhMfJZr3mjLMwhlXEJ5fBl0BoOz12WIE8V97YL0Aougmfb+bLWlDgRz1DvygzXBbSSR/29Rc=","w":80,"h":20,"aspect":"fixed","title":"input"},{"xml":"dVJNb4MwDP01OU4KQYPuuMLay3bqYccpBReyBsxCGHS/fk4IpZU2pAjb7/nbLM6aaW9kV79hCZrFLyzODKKdpWbKQGsmuCpZnDMhOD0mdv+gkUd5Jw209g8HPH5CYYmh5dElyz2YaOJuT9g6pLcXDR5JvgZcgIde/ZD1mQiR6KYVJKny/3RrlSXPNF8CUtY5ZmD40k4aR4UfZ7jM2XGw3WBnbOlCOPW+wbUqYXBoS3BUTlHHWlk4dLJw6EhzJFttG9dbFGrfyUZpl+51KFQpKVqGbY8unscPvrU82gQ9Q43G54q5/8gutapashU0VyBw21uDZ7ihPiVpLJMr8q5KWy9FKK1vmBCVj5BeJ/INxsL07/6im2HsARuw5kKUMcQndDOvmNegqjp4hbVz2c96dfVcj4GEMN9FDeexqOsZeurdlf4C","w":80,"h":20,"aspect":"fixed","title":"output"},{"xml":"dVNLU4NADP41HHXobgv1aFsfB51x9ODR2UIKqwvBJbWtv94ElhademBI8uX5JRvpZbW/86YpHzEHF+mbSC89IvVStV+Cc5GKbR7pVaRUzF+kbv9BJx0aN8ZDTWcCcP0OGbGHM2spturAxLHvYoO1IC0dHHRI8rmVNhbO1nBRgi1K1q7ZZcY5ZyecpaL7pwuyxMHpasjJhfu0waPrbuNwZ/HtAw59A5ttnZHFukeHUZSov6c8taa+wJPNjHuQOZ6wtV0CvVojEVZcanC4drYQgLBha0mVTD1hsSWPH/BqcyoHS2kaSd94zKBt2bIrLcFLYzIx73hJbPO4rXPIhxj7LVh8GSeJnqirq1RP0+k8Fsz47KWHE6HXOrdEh74bQOczmOfTYx8jZK7WOpGIjJkzzL0PtYTJW1NZJ7zdg/sCmfBIq0wM+3/vYDLi8w6wAvIHdtkFAoTxpL+VeNi1GNNgM22vF8fQY7ZnPilTF7waFYf6WoewsGI1Dfqo3PxMNfWnmnEEvjYEC2G9HZ8yC6NBTqbuVgY13Pugnt5VHz1+dj8=","w":260,"h":70,"aspect":"fixed","title":"function"},{"xml":"dVLLcsMgDPwa7gb/gd00p17a3DNKrNq0PDxYje18fSGAQzrNgRlJu9IuAla3etk7GIc326Fi9Y7VrbOWYqSXFpViopIdq1+YEJU/TLw+QfkNrUZwaOifBnv6wjN5hoJTEAuEg0P0ldYaAmnQxRGfys7SHr9xjazzI5wFRUgfvUy0KozoNEutwPisGUgHPe7DicDRh7wGkrfnMevkNczPjE3ssI6BRcFi3UTpCzrC5el9eeFoj1YjudVTZtnRkDynnVQDyn7IbTwVYYqFfuvdxr373YHpVVhXMiByW1oTr1Je6G2jSz3xRw4UoTNA2Ngf003lo/mguMq9dNt3TtPL5vT+g2J3+cF+AQ==","w":220,"h":110,"aspect":"fixed","title":"container"}]</mxlibrary>'
const flowio_lib = '<mxlibrary>[{"xml":"dVFBcoMwDHyN74CTJr2WNDn1lAd0jBHYjUGMUQr09ZUxNMlMc/CMVrtrrWUh82Y8edWZDyzBCfkuZO4RKVbNmINzIktsKeRBZFnCR2THJ2w6s0mnPLT0jwGLL9DECqeKMCwIevK2raOxcjhY/LzAFDmjfKk5VxnpdUwW4GOCniYHkfV4bYNFHhIh3wZjCc6d0oEd+KHcM9SE4SmXlXUuR4d+9spqr0Fr7nMqvMAdU+y3m224sMKWzvYnXJe+MI7RvsETjE+3kN4lPgE2QH5iyWBLMosieY02A7Y2i22ziz3VR1z/WW875WLZwgqXLa/w9puz9OGzfwE=","w":109,"h":47,"aspect":"fixed","title":"hardcoded block"},{"xml":"7VlNc6M4EP01rj0lBQj8cYztZPaQ2Z3abNUeUzLIoEQgR4g4nl+/3SCMAZnYG2dmD0M+jLolIfV7PLXkEVmkb18U3SRfZcTEiNyOyEJJqau79G3BhBh5Do9GZDnyPAf+Rt7dEa9bep0NVSzTlgZy9cRCDTUEXeHDlqVzLKDufC0z9OR6J1jpGb8UsnZc5fw7WG+ggudv3hon3MX4mcm07gieVvVVeaohrYXccvn4zHbVUzOasspTj93DYntazVg8JYssYljVgT63CdfsYUND9G4hemBLdIozcnHEXIiFFFKVbcnKjaI1Nsu1ks/swOM6EzJj+0G+MqXZ29FQugcj/MJkyrTaQZW6waQKtbPlkU4q22RqbAnjcWK6GRsbzatyvO+qAQpuTBTqooHuKIyq0CzHXtFc3vGU6hjvbPHfJFLLR8Gz57wNAxmEId/yVNCMGVo8GA8GN0y4iO7pThY4z1zT8LkuzROp+HeoT2uEwK30Q8mpJSF9yNYB/rRaPmCP5lmKIR+/1di4HdNX+taqeE9zXY9SCkE3OV+V48aGKVUxz+ZSa6BwVanHk3F5mUkf2KurDkY1HRfrIZN4SMWN4HEGxpRHkbgQ0YLAEMhAOZ32eOc7Ft5NPoV3o2B+DdUAoOunTTwKlkN821AYYYtu/iDdIEjahodTXh3aZLLkJTUhF2yth5DIQT54Ft+X1ZZ+Y/nLhAxNEprjVKCYQEOWIaekppqu9sTfSJ7pMqbBHH4hygvnOigjsYCy25ThF6sroFAGc6K8BJwBO7cs1316Oc5sdnfXeddwWBHNk1IM3Q73/FMpRuwUM2gRchqlyOQzKBWxPFR8E3IJ9oih8zeITxFxfNRLMVqQ0c0Rnpm2msusTbTggsvLMRE4omHDcnIoGx9Rh1oNghPVYPxR6HrZh+nxlYqCtXOLxG2ygVa2Ee6D0iQU9dt9YLJkJbB0sat6QpiXuNgk6Gcmt/lLwVJcFsFCU8Sy+l89vkgzXCOPpC578+EMPKtIHRDkLL0yqgOGoCn9LWGEyyvvGBvtunTI4UGJOKYztXaGQDamUKyY4kALph72o3RN59+oBntWWjzH/6xFr1Ykx7/uM3vmXya/sqnQnVQla2DYOUfJmYMoOinP+BomGVG7/uQJ3bDHEDMWIKhqa9Dk1NzqAlkCcdpZgjvph494lvC5zofzhJ4yTC3K0HmLysAh9aiKTpPgO5pygbP7nYlXhszrMN2zMfr4HqDy/GPC4w3sIxp4q9GcBNdkEC63Axfpo+Xa0LoQ2TuyvK7i3ojpQhaKI52dP9i2r7F6h9jd4Bq9O2sbiA0fTbPDN2U2vFonMl0V+dkbwTWNZpF1RabMd4l3mTfP6+8DLwXde++Z6/TeKxbFrE4dIfNMZCwzKm4ba2fdaOrcy3IRwjg+Ma135rWihZbtKFfPxAe1IpYDZ8LaZGyw7YtZHUXv5MgqJqjmr+3+P0x5a/6IqT3NO2cT7uG4LMpda9cOspKolJl3iLmqYn6/2htgcxuXSPxZaMxtjjJ4QkMbg1f+OHBOTv/f2WHO2lo0s629Ywulp5+zxRxE6jGVESzJQOA2ZMPnST8OMqg2jYgNMo/4fhBdBrIp+XmY9WWI9Nb7JtM2OzpMrTL5ih/Lfk79GedM3tiegP+UI6ZLZHhT53p2cAVBiwGBM2u5+6dEZpntpn/+2XzoE8C3EcDtwWw93zGwnH+0o3G9+l+e65yG9vCZTL29fg9A7/yNfR+/wIZfP2n/hd/p+AXeD8SvfxQD+JFf+H0Av8mJAvof8INi85Vf6Wt9I/gv","w":950.0000000000002,"h":614.0000000000003,"aspect":"fixed","title":"study"},{"xml":"7ZhLc+I4EMc/jY9J2fIDOAbYzB4yu1ObrdpjStgCayNLHlkOMJ9+W7L8woJhBmpP45CK1Xq41b9/txy8cFUcPklc5p9FRpgX/uaFKymEau6Kw4ow5iGfZl649hDy4ddDz2d6A9Prl1gSrhwTxOZfkioYwfBGP2xtOhMGY5dbwXXPFqfEdCRfa+3FciVqSYmErj/IvjfD3U7/VccSxj9lWOENrki7GjyyWbAZ1fi1ZWJPxds7OTaP1nPf+plosBOkm+NNVurIGteQzEWxqStYeJ9TRV7Lxuk9xBFsuSr03gK9KcrYSjAhzbxwi7NFFoO9UlK8k0EPJlEQos7TDyIVOZwNajDw7hMRBVHyCEPsBOQ/IjRDKA6SWRT4s3mzwJ5mKrfzLRY/J3SX20UTa8NV0951C/cA4cbGo21apNfi7YPYgtQdDxX9pinCABSVhyllLoofIstxcQI0vAxU1Dwjeqj/M1BnOHVB3URJ7Ef3gRrM/AnG2fx/w5iRKpW0TKkAe0ZMp77rksfHX2tvFXpPazcRu4Cigr9ta56O6UR3pAPiGDBoLge1WP+4qCXmsiu9GmGug+RGijYK83gCMfIdEGfJrRAntdk++QOzmoxTMw/6ZBola9oFpc/H0DfX0ORIakY5eWg3pNM60FPiaWJD3OuCk+psdnfmoZdorA/gocYimEC1Xo9lwAUnejBoifIdGOK+9bcAXa0f0DnFCdCB1jhYcpplhINtrNMMV7lpBCdaiqYq9f3F4hm4LjGjO1hqnYKg4NALlyWRFNAT+dp5GdjFv2AFdm4syNQZrU2aYvZkVynAMx2ke0gXhYvHqXoX0X1KkKvmPAtZ4MbtiurasoQi7heU0y1sMsPuQlPlGE71FOKLQYRyXGeSi3Wm2tOCYX5rwOyEJLRhaHM/elwMrvliEszQdSwH/s0FfVILZo5acJJTJoxaiEfI5cxI8TuFd9Oo/2XTGXD6vjM58WetdEUY5MIzLijTgfmdsA+iRXuSJMiVDOdP2KbnHxtLdOGUvopscpFsh8SSDad5ca83rAm6+QRd2pXQU4S9nE1kbY+uTWlOWfaCj6LWrlUKSLWtZS4k/abTpy+mWLZcUOKuof2kV72YfYwk+sXuSxvY4MT0GR9GA19wpVoHBWO4rOiGtaopsNxRvhRKwbtgM+gOSRrGJyjbVBiwhCrnSsvodpgLF8zg3Pk2Vr8NvINFmzaMbJXjUFD6ZGuPuRczZh31lr/sHqOzh5zSL32dlEpBuTIxiJfwgXCufDgoYnB8Be2gb8NHD5dw8HHYC5Rn/RwC0PekUtfynF8+pZLr8KEff8Ga/rfru/BNS+kvfFfji6/MvrvgC1z4wl/4fh6f46uGe+GDZv+1lOkbfWv1Hw==","w":950,"h":426.0000000000002,"aspect":"fixed","title":"database"},{"xml":"xVjbcuI4EP0aPyblO/AYSJh9yGylNlu1j5SwBVYiWx5JDjBfvy1ZxjaWKWbjzBKoWK17n6PTbTnBKj9+46jMvrMUUyd4coIVZ0zWT/lxhSl1fJekTvDo+L4LP8dfj9R6utYtEceFvKWDX3cQ8kRxbcHpHr+aIuMyY3tWIPrUWpecVUWK1QAulNo2z4yVYPTA+IalPL2Sn2oQVEkGpkzm1NTuWCFXjDKuZwxcd7FYr43ddPJiKNdrUwvq7U6wiifGtKhNEvE9NhsOhz7QHY0DvmGWY8lP0IRjiiT56I+ORF3cn9udu74wAiP67tF0iGvfuiczsR/eR/1B6qWafi0MD5yjU6dZqRqI8ZnC+dhM6//aAx7qVTSljmdak2aLLrLtG07UBBRtFU0f9WAxlQa3HoniHxVrKu6ERvQBGvhheWwr4Wmv/hcsbwaCOeux6pp6BzvKDoRt3rHZSoFyXNc0JA46njP87hC6T9dDRiR+LZEm0AHO3QU1CaUdaqYRnqch2IXk7B13aub+Nohbkn5gLvHRGTuEIwRsOswMWAeSyqy2zRoAM0z2mRmmIZyNox1gu7hB0UA3CqOAI0xStPHs/maVLCu52VVF0nd7OJ3bUyQy3daCAfYAhZkNg0U8C1A8KhyfwmTu9g9QsDgf7g5KXvjbUOKVxEKNqsz6ieRI7rGwo1ZmTLINJcW76KMWXUVNHEhOUYEbp5oaBWGSEZo+oxPwASxCouS9KS0zxslPaI8aQKGaN5AEwRDUXaT+ej1f1YhmLo6Varw0aHkXpu/o2Gv4jIRsVskoRaUgW71u1TGH2ECKJZMShKZuNGBSrD/D0FR/LAxT3CIJog+U7Asw5iRNdXCcgHpR1KfefD7gXehaeDf7Et450fIemgFA92/l3oker/GtRLDCHt3iq3QDJ0kbHq7+XNCmYJqXyLic4p28hoQAtSHF/lk3ewxby1/GZcrEoLvaChQz6IgLnd9IJNH2THwTnWFh0RK+4OWVC1qgPLGCsteW4auac6BQAXtCRAOOgZ0HLOSQXv3Mx7glHOhhh3vhrRSL7BRr1Cy4jVLB7CsolWKRcFImhIE9xbpSUQoiDHFWgbMM1JQ/KvX8MMI3M4YkrLCEptmEGcGYIowI2nVtmSpKNdIwDEl2aYg/i+PgzcGI0geiFe6ng5nXJnC9BDE5O6XNAZuj3jFZEkmIY/iu2ZBKJT3VJRomk0/iR4VzNJpQns3dRfpWUepw4Jf0yagMGKK29Ld+Nbrzxwhn16EuTa9KwpiuNFqZAJ8wV+KEOQHkMX89r7LJv16QBHuhLb4bflWQaxTIteVTi4nyKZvqwMI4SpFdTkhhz3EXvyfH3e12fpLYmJbG2zj6IvX433PaNePqrKpdiFb5c1KQHfBuDCuRoRJvEpU0gizwPmCee2t+O0GmFly8JHizoTsD3+JOz/20P4d3P55FkS+krTnRzwqDFyaIip9QtTXZ8eDIS1bapPAfsz9fWRQc8FxylmAhRg5Ce1T0KDWR3XutXognhtkN0dcoJ1Q59Q9MP7Ba0cUJ8G2iZzR5IHrjL+9jr/u3ccO9Sg7Pu3iDtBw1GzcmkruL2LtDST+krljFiTo97p/4MAyk8qRAfVCKqDnyKzc0qu+m7dk7nv51Qc1Yvq3GODR+T7ND6SK1Zl8Ih17gT3Pc/eE1zVQI3iCWN8avDSvlhc8nvB+7HsRwPBLEZottnS5NH8RCy+XZF4UwKLY38/WVaffi/l8=","w":950,"h":530,"aspect":"fixed","title":"function"}]</mxlibrary>'
