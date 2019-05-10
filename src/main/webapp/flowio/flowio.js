const fs = require('fs')
const path = require('path')
const drawionode = require('./drawio-node')
const ROOT_ID = 1
const getBasics = (basics_file_path)=>{
  return fs.existsSync(basics_file_path)?fs.readFileSync(basics_file_path):basics
}
const guidGenerator = ()=>{
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+"-"+S4()+"-"+S4()+"-"+S4());
}
const createMinimizedFunctionCell = (basics_lib_path, inputs, outputs, flowio_id, function_name, mxCell_func=null, top_padding=10, padding_side=20)=>{
	let basics_lib = getBasics(basics_lib_path)
	let function_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'function')

	let input_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'input')
	let output_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'output')
	return Promise.all([function_promise,input_promise,output_promise]).then(function(result){
			let real_func_id = flowio_id//'function'-guidGenerator()
			//function_id+'-function-'+Date.now()
			let func = result[0][0]
			let geo_func = drawionode.getGeoSimpleBlock(func)
			let input = result[1][0]
			let geo_input = drawionode.getGeoSimpleBlock(input)
			let output = result[2][0]
			let geo_output = drawionode.getGeoSimpleBlock(output)
			let input_blocks = inputs.map((input_text, index)=>(drawionode.modifySimpleBlock(block_o=input,id='input-'+guidGenerator(),id_parent=real_func_id, input_text, x=padding_side, y=index*(Number(geo_input.height)+top_padding)+top_padding)))
			let output_blocks = outputs.map((output_text, index)=>(drawionode.modifySimpleBlock(block_o=output,id='output-'+guidGenerator(),id_parent=real_func_id, output_text, x=2*padding_side+Number(geo_input.width), y=index*(Number(geo_output.height)+top_padding)+top_padding)))
			if(mxCell_func){
				//console.log(JSON.stringify(func.object.mxCell,null,2))
				//console.log(JSON.stringify(explicitChildrenToNot(mxCell_func),null,2))
				func.object.mxCell[0].$.style=mxCell_func.$.style
			}
			//console.log(geo_func.width,geo_input.width, geo_output.width)
			let func_block = drawionode.modifySimpleBlock(func,id=real_func_id, id_parent=ROOT_ID, function_name, x=null, y=null, width=Number(geo_output.width)+Number(geo_input.width)+3*padding_side, height=(Number(geo_output.height)+top_padding)*Math.max(inputs.length, outputs.length)+top_padding, flowio_id=flowio_id)
			return [func_block].concat(input_blocks).concat(output_blocks)
	})
}


const importFunction=(result_decompressed, file_id,basics_file_path)=>{
	let shapes = drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'shape_container'})
	let shape = null
	if(shapes.length>0){
		let id_parent = shapes[0].object.$.id
		let find_shapes = drawionode.findChildrenValueFilter(result_decompressed,{'parent':id_parent})
		if(find_shapes.length>0){
			shape = find_shapes[0].mxCell
		}
	}
	let inputs = drawionode.getClearLabels(drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'input_func'}))
	let name_func = drawionode.getClearLabels(drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'name'}))[0]

	let outputs = drawionode.getClearLabels(drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'output_func'}))
	return createMinimizedFunctionCell(basics_file_path,inputs, outputs, file_id, name_func, shape).then((all_blocks)=>([all_blocks,name_func]))
}
const importBlock=(result_decompressed, file_id, flowio_key)=>{
	let basics_lib = getBasics()
	let shapes = drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'shape_container'})
	let function_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'function')
  //console.log(function_promise)
	let name = drawionode.getClearLabels(drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'name'}))[0]

  let shape = null
	if(shapes.length>0){
		let id_parent = shapes[0].object.$.id
		let find_shapes = drawionode.findChildrenValueFilter(result_decompressed,{'parent':id_parent})
		if(find_shapes.length>0){
			shape = find_shapes[0].mxCell
		}
	}
	//console.log(JSON.stringify(shapes,null,2))
	return function_promise.then((data)=>{
		let func = data[0]
		if(shape){
			func.object.mxCell[0].$.style=shape.$.style
		}
    func.object.$.flowio_key=flowio_key
		let func_block = drawionode.modifySimpleBlock(func,id=file_id, id_parent=ROOT_ID, name, null, null,null,null, flowio_id=file_id)
		return [[func_block],name]
	})
}

const importLibraryFlowio=(loadLocalLibrary)=>{
	loadLocalLibrary('flowio', flowio_lib)
}

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
						return drawionode.parseString(drawionode.decompress(compressed)).then((result_decompressed)=>{
							let xml_data = null
							if (drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'type_function'}).length>0){
								xml_data = importFunction(result_decompressed,file_id,basics_file_path)
							}else if (drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'type_study'}).length>0){
								xml_data = importBlock(result_decompressed, file_id, 'study')
								let id = drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'database_modified'})[0].object.$.id
								console.log(id)
								//console.log(JSON.stringify(drawionode.findRelated(result_decompressed, id)[0], null, 2))
							}else if (drawionode.findChildrenValueFilter(result_decompressed, {'flowio_key':'type_database'}).length>0){
								xml_data = importBlock(result_decompressed, file_id, 'database')
							}
							if(xml_data!=null){
								return xml_data.then((data)=>{
									let all_blocks = data[0]
									let name_func = data[1]
									let mxGraph = drawionode.getDiagram(all_blocks, ROOT_ID)
									let value = drawionode.compress(drawionode.toString(mxGraph,{headless:true}))
									return {'drawio':{'key':name_func?name_func:file_id, 'value':value}}

								}).catch((err)=>(console.log(err)))
							}
            }).catch((err)=>(console.log(err)))
				}).catch((err)=>(console.log(err)))
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

const createFlowioIndex=(original_path, added_path='./')=>{
  //console.log(original_path,added_path)
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
  }else if(lstat.isFile()){
      let file_id = lstat.ino
      let return_val = {}
      return_val[file_id]=file_path
      return return_val
  }s
}
const createFileIndex=(original_path)=>{
  createFlowioIndex(original_path).then((result)=>{
    fs.writeFile(path.join(original_path,'.flowio'), JSON.stringify(result), (err)=>{
    })
  })
}

const getFileIndex=(original_path)=>{
  return fs.promises.readFile(path.join(original_path,'.flowio')).then((data)=>JSON.parse(data))
}



module.exports={
    importLocalLibraries: importLocalLibraries,
		importLibraryFlowio:importLibraryFlowio,
    createFileIndex:createFileIndex,
    getFileIndex:getFileIndex,
}
const basics = '<mxlibrary>[{"xml":"dVJNc4IwEP01HO1AouC1QvXSnjz02ImwSGpgaQgF++u7CUF0pj0w7Mt7efuRDXhajwct2uoNC1ABfwl4qhHNFNVjCkoFLJRFwLOAsZC+gO3/YSPHhq3Q0Jg/LuDpE3JDCiVONlnmyFiRdldiY5nOXBU4Jv7qcSZWnfyh02cSRKwdF5Kis/snOyMN3Uyy2ZCyTp5e4UorFQ4SPy5wnbLLpu3NRM1NMAsf+1uKYhr7pgArDcl0qKSBYytyyw40RjqrTG1bi3zpe1FLZbO99rksBLml2HRo/Rx/dJ1l0ZawUPLcEMhpfKDpoDMaL5CiQu3S8yI+xZv4xrzLwlRzMqnUnbIsS5bnt8a/QRsY/32m6K7pA2ANRl9J4i+wJ5bwhMfJZr3mjLMwhlXEJ5fBl0BoOz12WIE8V97YL0Aougmfb+bLWlDgRz1DvygzXBbSSR/29Rc=","w":80,"h":20,"aspect":"fixed","title":"input"},{"xml":"dVJNb4MwDP01OU4KQYPuuMLay3bqYccpBReyBsxCGHS/fk4IpZU2pAjb7/nbLM6aaW9kV79hCZrFLyzODKKdpWbKQGsmuCpZnDMhOD0mdv+gkUd5Jw209g8HPH5CYYmh5dElyz2YaOJuT9g6pLcXDR5JvgZcgIde/ZD1mQiR6KYVJKny/3RrlSXPNF8CUtY5ZmD40k4aR4UfZ7jM2XGw3WBnbOlCOPW+wbUqYXBoS3BUTlHHWlk4dLJw6EhzJFttG9dbFGrfyUZpl+51KFQpKVqGbY8unscPvrU82gQ9Q43G54q5/8gutapashU0VyBw21uDZ7ihPiVpLJMr8q5KWy9FKK1vmBCVj5BeJ/INxsL07/6im2HsARuw5kKUMcQndDOvmNegqjp4hbVz2c96dfVcj4GEMN9FDeexqOsZeurdlf4C","w":80,"h":20,"aspect":"fixed","title":"output"},{"xml":"dVNLU4NADP41HHXobgv1aFsfB51x9ODR2UIKqwvBJbWtv94ElhademBI8uX5JRvpZbW/86YpHzEHF+mbSC89IvVStV+Cc5GKbR7pVaRUzF+kbv9BJx0aN8ZDTWcCcP0OGbGHM2spturAxLHvYoO1IC0dHHRI8rmVNhbO1nBRgi1K1q7ZZcY5ZyecpaL7pwuyxMHpasjJhfu0waPrbuNwZ/HtAw59A5ttnZHFukeHUZSov6c8taa+wJPNjHuQOZ6wtV0CvVojEVZcanC4drYQgLBha0mVTD1hsSWPH/BqcyoHS2kaSd94zKBt2bIrLcFLYzIx73hJbPO4rXPIhxj7LVh8GSeJnqirq1RP0+k8Fsz47KWHE6HXOrdEh74bQOczmOfTYx8jZK7WOpGIjJkzzL0PtYTJW1NZJ7zdg/sCmfBIq0wM+3/vYDLi8w6wAvIHdtkFAoTxpL+VeNi1GNNgM22vF8fQY7ZnPilTF7waFYf6WoewsGI1Dfqo3PxMNfWnmnEEvjYEC2G9HZ8yC6NBTqbuVgY13Pugnt5VHz1+dj8=","w":260,"h":70,"aspect":"fixed","title":"function"}]</mxlibrary>'
const flowio_lib = '<mxlibrary>[{"xml":"dVFBcoMwDHyN74CTJr2WNDn1lAd0jBHYjUGMUQr09ZUxNMlMc/CMVrtrrWUh82Y8edWZDyzBCfkuZO4RKVbNmINzIktsKeRBZFnCR2THJ2w6s0mnPLT0jwGLL9DECqeKMCwIevK2raOxcjhY/LzAFDmjfKk5VxnpdUwW4GOCniYHkfV4bYNFHhIh3wZjCc6d0oEd+KHcM9SE4SmXlXUuR4d+9spqr0Fr7nMqvMAdU+y3m224sMKWzvYnXJe+MI7RvsETjE+3kN4lPgE2QH5iyWBLMosieY02A7Y2i22ziz3VR1z/WW875WLZwgqXLa/w9puz9OGzfwE=","w":109,"h":47,"aspect":"fixed","title":"hardcoded block"},{"xml":"7VlNc6M4EP01rj0lBQj8cYztZPaQ2Z3abNUeUzLIoEQgR4g4nl+/3SCMAZnYG2dmD0M+jLolIfV7PLXkEVmkb18U3SRfZcTEiNyOyEJJqau79G3BhBh5Do9GZDnyPAf+Rt7dEa9bep0NVSzTlgZy9cRCDTUEXeHDlqVzLKDufC0z9OR6J1jpGb8UsnZc5fw7WG+ggudv3hon3MX4mcm07gieVvVVeaohrYXccvn4zHbVUzOasspTj93DYntazVg8JYssYljVgT63CdfsYUND9G4hemBLdIozcnHEXIiFFFKVbcnKjaI1Nsu1ks/swOM6EzJj+0G+MqXZ29FQugcj/MJkyrTaQZW6waQKtbPlkU4q22RqbAnjcWK6GRsbzatyvO+qAQpuTBTqooHuKIyq0CzHXtFc3vGU6hjvbPHfJFLLR8Gz57wNAxmEId/yVNCMGVo8GA8GN0y4iO7pThY4z1zT8LkuzROp+HeoT2uEwK30Q8mpJSF9yNYB/rRaPmCP5lmKIR+/1di4HdNX+taqeE9zXY9SCkE3OV+V48aGKVUxz+ZSa6BwVanHk3F5mUkf2KurDkY1HRfrIZN4SMWN4HEGxpRHkbgQ0YLAEMhAOZ32eOc7Ft5NPoV3o2B+DdUAoOunTTwKlkN821AYYYtu/iDdIEjahodTXh3aZLLkJTUhF2yth5DIQT54Ft+X1ZZ+Y/nLhAxNEprjVKCYQEOWIaekppqu9sTfSJ7pMqbBHH4hygvnOigjsYCy25ThF6sroFAGc6K8BJwBO7cs1316Oc5sdnfXeddwWBHNk1IM3Q73/FMpRuwUM2gRchqlyOQzKBWxPFR8E3IJ9oih8zeITxFxfNRLMVqQ0c0Rnpm2msusTbTggsvLMRE4omHDcnIoGx9Rh1oNghPVYPxR6HrZh+nxlYqCtXOLxG2ygVa2Ee6D0iQU9dt9YLJkJbB0sat6QpiXuNgk6Gcmt/lLwVJcFsFCU8Sy+l89vkgzXCOPpC578+EMPKtIHRDkLL0yqgOGoCn9LWGEyyvvGBvtunTI4UGJOKYztXaGQDamUKyY4kALph72o3RN59+oBntWWjzH/6xFr1Ykx7/uM3vmXya/sqnQnVQla2DYOUfJmYMoOinP+BomGVG7/uQJ3bDHEDMWIKhqa9Dk1NzqAlkCcdpZgjvph494lvC5zofzhJ4yTC3K0HmLysAh9aiKTpPgO5pygbP7nYlXhszrMN2zMfr4HqDy/GPC4w3sIxp4q9GcBNdkEC63Axfpo+Xa0LoQ2TuyvK7i3ojpQhaKI52dP9i2r7F6h9jd4Bq9O2sbiA0fTbPDN2U2vFonMl0V+dkbwTWNZpF1RabMd4l3mTfP6+8DLwXde++Z6/TeKxbFrE4dIfNMZCwzKm4ba2fdaOrcy3IRwjg+Ma135rWihZbtKFfPxAe1IpYDZ8LaZGyw7YtZHUXv5MgqJqjmr+3+P0x5a/6IqT3NO2cT7uG4LMpda9cOspKolJl3iLmqYn6/2htgcxuXSPxZaMxtjjJ4QkMbg1f+OHBOTv/f2WHO2lo0s629Ywulp5+zxRxE6jGVESzJQOA2ZMPnST8OMqg2jYgNMo/4fhBdBrIp+XmY9WWI9Nb7JtM2OzpMrTL5ih/Lfk79GedM3tiegP+UI6ZLZHhT53p2cAVBiwGBM2u5+6dEZpntpn/+2XzoE8C3EcDtwWw93zGwnH+0o3G9+l+e65yG9vCZTL29fg9A7/yNfR+/wIZfP2n/hd/p+AXeD8SvfxQD+JFf+H0Av8mJAvof8INi85Vf6Wt9I/gv","w":950.0000000000002,"h":614.0000000000003,"aspect":"fixed","title":"study"},{"xml":"7ZhLc+I4EMc/jY9J2fIDOAbYzB4yu1ObrdpjStgCayNLHlkOMJ9+W7L8woJhBmpP45CK1Xq41b9/txy8cFUcPklc5p9FRpgX/uaFKymEau6Kw4ow5iGfZl649hDy4ddDz2d6A9Prl1gSrhwTxOZfkioYwfBGP2xtOhMGY5dbwXXPFqfEdCRfa+3FciVqSYmErj/IvjfD3U7/VccSxj9lWOENrki7GjyyWbAZ1fi1ZWJPxds7OTaP1nPf+plosBOkm+NNVurIGteQzEWxqStYeJ9TRV7Lxuk9xBFsuSr03gK9KcrYSjAhzbxwi7NFFoO9UlK8k0EPJlEQos7TDyIVOZwNajDw7hMRBVHyCEPsBOQ/IjRDKA6SWRT4s3mzwJ5mKrfzLRY/J3SX20UTa8NV0951C/cA4cbGo21apNfi7YPYgtQdDxX9pinCABSVhyllLoofIstxcQI0vAxU1Dwjeqj/M1BnOHVB3URJ7Ef3gRrM/AnG2fx/w5iRKpW0TKkAe0ZMp77rksfHX2tvFXpPazcRu4Cigr9ta56O6UR3pAPiGDBoLge1WP+4qCXmsiu9GmGug+RGijYK83gCMfIdEGfJrRAntdk++QOzmoxTMw/6ZBola9oFpc/H0DfX0ORIakY5eWg3pNM60FPiaWJD3OuCk+psdnfmoZdorA/gocYimEC1Xo9lwAUnejBoifIdGOK+9bcAXa0f0DnFCdCB1jhYcpplhINtrNMMV7lpBCdaiqYq9f3F4hm4LjGjO1hqnYKg4NALlyWRFNAT+dp5GdjFv2AFdm4syNQZrU2aYvZkVynAMx2ke0gXhYvHqXoX0X1KkKvmPAtZ4MbtiurasoQi7heU0y1sMsPuQlPlGE71FOKLQYRyXGeSi3Wm2tOCYX5rwOyEJLRhaHM/elwMrvliEszQdSwH/s0FfVILZo5acJJTJoxaiEfI5cxI8TuFd9Oo/2XTGXD6vjM58WetdEUY5MIzLijTgfmdsA+iRXuSJMiVDOdP2KbnHxtLdOGUvopscpFsh8SSDad5ca83rAm6+QRd2pXQU4S9nE1kbY+uTWlOWfaCj6LWrlUKSLWtZS4k/abTpy+mWLZcUOKuof2kV72YfYwk+sXuSxvY4MT0GR9GA19wpVoHBWO4rOiGtaopsNxRvhRKwbtgM+gOSRrGJyjbVBiwhCrnSsvodpgLF8zg3Pk2Vr8NvINFmzaMbJXjUFD6ZGuPuRczZh31lr/sHqOzh5zSL32dlEpBuTIxiJfwgXCufDgoYnB8Be2gb8NHD5dw8HHYC5Rn/RwC0PekUtfynF8+pZLr8KEff8Ga/rfru/BNS+kvfFfji6/MvrvgC1z4wl/4fh6f46uGe+GDZv+1lOkbfWv1Hw==","w":950,"h":426.0000000000002,"aspect":"fixed","title":"database"},{"xml":"xVjbcuI4EP0aPyblO/AYSJh9yGylNlu1j5SwBVYiWx5JDjBfvy1ZxjaWKWbjzBKoWK17n6PTbTnBKj9+46jMvrMUUyd4coIVZ0zWT/lxhSl1fJekTvDo+L4LP8dfj9R6utYtEceFvKWDX3cQ8kRxbcHpHr+aIuMyY3tWIPrUWpecVUWK1QAulNo2z4yVYPTA+IalPL2Sn2oQVEkGpkzm1NTuWCFXjDKuZwxcd7FYr43ddPJiKNdrUwvq7U6wiifGtKhNEvE9NhsOhz7QHY0DvmGWY8lP0IRjiiT56I+ORF3cn9udu74wAiP67tF0iGvfuiczsR/eR/1B6qWafi0MD5yjU6dZqRqI8ZnC+dhM6//aAx7qVTSljmdak2aLLrLtG07UBBRtFU0f9WAxlQa3HoniHxVrKu6ERvQBGvhheWwr4Wmv/hcsbwaCOeux6pp6BzvKDoRt3rHZSoFyXNc0JA46njP87hC6T9dDRiR+LZEm0AHO3QU1CaUdaqYRnqch2IXk7B13aub+Nohbkn5gLvHRGTuEIwRsOswMWAeSyqy2zRoAM0z2mRmmIZyNox1gu7hB0UA3CqOAI0xStPHs/maVLCu52VVF0nd7OJ3bUyQy3daCAfYAhZkNg0U8C1A8KhyfwmTu9g9QsDgf7g5KXvjbUOKVxEKNqsz6ieRI7rGwo1ZmTLINJcW76KMWXUVNHEhOUYEbp5oaBWGSEZo+oxPwASxCouS9KS0zxslPaI8aQKGaN5AEwRDUXaT+ej1f1YhmLo6Varw0aHkXpu/o2Gv4jIRsVskoRaUgW71u1TGH2ECKJZMShKZuNGBSrD/D0FR/LAxT3CIJog+U7Asw5iRNdXCcgHpR1KfefD7gXehaeDf7Et450fIemgFA92/l3oker/GtRLDCHt3iq3QDJ0kbHq7+XNCmYJqXyLic4p28hoQAtSHF/lk3ewxby1/GZcrEoLvaChQz6IgLnd9IJNH2THwTnWFh0RK+4OWVC1qgPLGCsteW4auac6BQAXtCRAOOgZ0HLOSQXv3Mx7glHOhhh3vhrRSL7BRr1Cy4jVLB7CsolWKRcFImhIE9xbpSUQoiDHFWgbMM1JQ/KvX8MMI3M4YkrLCEptmEGcGYIowI2nVtmSpKNdIwDEl2aYg/i+PgzcGI0geiFe6ng5nXJnC9BDE5O6XNAZuj3jFZEkmIY/iu2ZBKJT3VJRomk0/iR4VzNJpQns3dRfpWUepw4Jf0yagMGKK29Ld+Nbrzxwhn16EuTa9KwpiuNFqZAJ8wV+KEOQHkMX89r7LJv16QBHuhLb4bflWQaxTIteVTi4nyKZvqwMI4SpFdTkhhz3EXvyfH3e12fpLYmJbG2zj6IvX433PaNePqrKpdiFb5c1KQHfBuDCuRoRJvEpU0gizwPmCee2t+O0GmFly8JHizoTsD3+JOz/20P4d3P55FkS+krTnRzwqDFyaIip9QtTXZ8eDIS1bapPAfsz9fWRQc8FxylmAhRg5Ce1T0KDWR3XutXognhtkN0dcoJ1Q59Q9MP7Ba0cUJ8G2iZzR5IHrjL+9jr/u3ccO9Sg7Pu3iDtBw1GzcmkruL2LtDST+krljFiTo97p/4MAyk8qRAfVCKqDnyKzc0qu+m7dk7nv51Qc1Yvq3GODR+T7ND6SK1Zl8Ih17gT3Pc/eE1zVQI3iCWN8avDSvlhc8nvB+7HsRwPBLEZottnS5NH8RCy+XZF4UwKLY38/WVaffi/l8=","w":950,"h":530,"aspect":"fixed","title":"function"}]</mxlibrary>'
