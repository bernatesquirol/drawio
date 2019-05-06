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
	let shapes = drawionode.findChildren(result_decompressed, {'flowio_key':'shape_container'})
	let shape = null
	if(shapes.length>0){
		let id_parent = shapes[0].object.$.id
		let find_shapes = drawionode.findChildren(result_decompressed,{'parent':id_parent})
		if(find_shapes.length>0){
			shape = find_shapes[0].mxCell
		}
	}
	let inputs = drawionode.getClearLabels(drawionode.findChildren(result_decompressed, {'flowio_key':'input_func'}))
	let name_func = drawionode.getClearLabels(drawionode.findChildren(result_decompressed, {'flowio_key':'name'}))[0]
	let outputs = drawionode.getClearLabels(drawionode.findChildren(result_decompressed, {'flowio_key':'output_func'}))
	return createMinimizedFunctionCell(basics_file_path,inputs, outputs, file_id, name_func, shape).then((all_blocks)=>([all_blocks,name_func]))
}
const importDatabase=(result_decompressed, file_id, basics_lib_path)=>{
	let basics_lib = getBasics(basics_lib_path)
	let shapes = drawionode.findChildren(result_decompressed, {'flowio_key':'shape_container'})
	let function_promise = drawionode.getSimpleBlockFromLibrary(basics_lib, 'function')
	let name = drawionode.getClearLabels(drawionode.findChildren(result_decompressed, {'flowio_key':'name'}))[0]
	let shape = null
	if(shapes.length>0){
		let id_parent = shapes[0].object.$.id
		let find_shapes = drawionode.findChildren(result_decompressed,{'parent':id_parent})
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
							if (drawionode.findChildren(result_decompressed, {'flowio_key':'type_function'}).length>0){
								xml_data = importFunction(result_decompressed,file_id,basics_file_path)
							}else if (drawionode.findChildren(result_decompressed, {'flowio_key':'type_study'}).length>0){
								xml_data = importDatabase(result_decompressed, file_id)
							}else if (drawionode.findChildren(result_decompressed, {'flowio_key':'type_database'}).length>0){
								xml_data = importDatabase(result_decompressed, file_id)
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

module.exports={
    importLocalLibraries: importLocalLibraries,
		importLibraryFlowio:importLibraryFlowio
}
const basics = '<mxlibrary>[{"xml":"dVJNc4IwEP01HO1AouC1QvXSnjz02ImwSGpgaQgF++u7CUF0pj0w7Mt7efuRDXhajwct2uoNC1ABfwl4qhHNFNVjCkoFLJRFwLOAsZC+gO3/YSPHhq3Q0Jg/LuDpE3JDCiVONlnmyFiRdldiY5nOXBU4Jv7qcSZWnfyh02cSRKwdF5Kis/snOyMN3Uyy2ZCyTp5e4UorFQ4SPy5wnbLLpu3NRM1NMAsf+1uKYhr7pgArDcl0qKSBYytyyw40RjqrTG1bi3zpe1FLZbO99rksBLml2HRo/Rx/dJ1l0ZawUPLcEMhpfKDpoDMaL5CiQu3S8yI+xZv4xrzLwlRzMqnUnbIsS5bnt8a/QRsY/32m6K7pA2ANRl9J4i+wJ5bwhMfJZr3mjLMwhlXEJ5fBl0BoOz12WIE8V97YL0Aougmfb+bLWlDgRz1DvygzXBbSSR/29Rc=","w":80,"h":20,"aspect":"fixed","title":"input"},{"xml":"dVJNb4MwDP01OU4KQYPuuMLay3bqYccpBReyBsxCGHS/fk4IpZU2pAjb7/nbLM6aaW9kV79hCZrFLyzODKKdpWbKQGsmuCpZnDMhOD0mdv+gkUd5Jw209g8HPH5CYYmh5dElyz2YaOJuT9g6pLcXDR5JvgZcgIde/ZD1mQiR6KYVJKny/3RrlSXPNF8CUtY5ZmD40k4aR4UfZ7jM2XGw3WBnbOlCOPW+wbUqYXBoS3BUTlHHWlk4dLJw6EhzJFttG9dbFGrfyUZpl+51KFQpKVqGbY8unscPvrU82gQ9Q43G54q5/8gutapashU0VyBw21uDZ7ihPiVpLJMr8q5KWy9FKK1vmBCVj5BeJ/INxsL07/6im2HsARuw5kKUMcQndDOvmNegqjp4hbVz2c96dfVcj4GEMN9FDeexqOsZeurdlf4C","w":80,"h":20,"aspect":"fixed","title":"output"},{"xml":"dVNLU4NADP41HHXobgv1aFsfB51x9ODR2UIKqwvBJbWtv94ElhademBI8uX5JRvpZbW/86YpHzEHF+mbSC89IvVStV+Cc5GKbR7pVaRUzF+kbv9BJx0aN8ZDTWcCcP0OGbGHM2spturAxLHvYoO1IC0dHHRI8rmVNhbO1nBRgi1K1q7ZZcY5ZyecpaL7pwuyxMHpasjJhfu0waPrbuNwZ/HtAw59A5ttnZHFukeHUZSov6c8taa+wJPNjHuQOZ6wtV0CvVojEVZcanC4drYQgLBha0mVTD1hsSWPH/BqcyoHS2kaSd94zKBt2bIrLcFLYzIx73hJbPO4rXPIhxj7LVh8GSeJnqirq1RP0+k8Fsz47KWHE6HXOrdEh74bQOczmOfTYx8jZK7WOpGIjJkzzL0PtYTJW1NZJ7zdg/sCmfBIq0wM+3/vYDLi8w6wAvIHdtkFAoTxpL+VeNi1GNNgM22vF8fQY7ZnPilTF7waFYf6WoewsGI1Dfqo3PxMNfWnmnEEvjYEC2G9HZ8yC6NBTqbuVgY13Pugnt5VHz1+dj8=","w":260,"h":70,"aspect":"fixed","title":"function"}]</mxlibrary>'
const flowio_lib = '<mxlibrary>[{"xml":"xVhNc6M4EP01HJPi2/YxduKZQ2YqtdmqPbpkEEaJQEQSsT2/fltCGDDCldk4s45dQS21kPq9fmpwglVx+MZRlf9gKaZO8OAEK86YbK6KwwpT6vguSZ3g3vF9F36Ov57o9XSvWyGOS/kRB79xEPJIcWPB6Q4/mybjMmc7ViL60FmXnNVlitUELrS6MY+MVWD0wPiCpTw+k19qElRLBqZcFtT0ZqyUK0YZ13cMXHexWK+N3Th5MbSbtakFDXYnWM0TY1o0Jon4DpsNh+MYaEcTgG+YFVjyIwzhmCJJ3oezI9E0d6dxJ9cnRmBG3z0Yh7iJrXs0N/bD22g4SbNU49fBcMc5OvaGVWqAmL5TOJ+60/q/esBFs4q21YtMZ9Js0U22fcGJugFFW0XTez1ZTKXBbUCi+K1mbceN0IjewQA/rA5dJ1zt1P+SFe1EcM9mrqan2UFG2Z6wzSs2WylRgZuelsRBL3KG3z1CD+m6z4nEzxXSBNpD3p1Rk1Dao2Ya4Xkagl1Izl5xr2fub4O4I+k75hIfnKkknCBg6zAzYO1JKvPGNmsBzDHZ5WaalnA2jvaA7eMGTQPdJIwCUpikaOPZ481qWdVyk9VlMgx7eL2wp0jkeqwFA+wBCjMbBot4FqB4Ujg+hcncHSZQsDgldw8lL/xjKPFaYqFmVWZ9RQokd1jYUatyJtmGkvJVDFGLLqIm9qSgqMRtUE2PgjDJCU0f0RH4ABYhUfLatpY54+QXjEctoNDNW0iCYAxqFqm/geezmtHci2OlGk8tWt6Z6Qc6DAY+IiHbVTJKUSXIVq9bORZwNpByyaQEoWkGjZgU68/4aGo+FoYpbpEE0TtKdiUYC5Km+nC8AvWiaEi9+XzEu9C18G72JbxzouUtDAOAbl+qnRPdX+JbhWCFA7rFF+kGQZI2PFz9OaNNyTQvkQk5xZm8hIQAtSHl7lEPuw87y18mZMrEwF1tBZo5OOJS1zcSSbQ9Ed+czrCwaAlfiPLKBS1QkVhB2+va8FXDOVCohD0hogHHwM49FnJMr2HlY8ISjvSwx73woxSL7BRr1Sz4GKWC2VdQKsUi4aRKCAN7inWnohScMMRZBc4yULd8q9X13QTfzBySsNJyNM2uWBFMKcKEoF3WlmudUq00jI8kuzTEn8Vx9ORgROkd0RoPy8Hc6wq4QYGYnILS1YBtqvdMlkISzjF8025IlZKeconGxeSDeKtxgSYLypO5v0jfKko9DvyWPhmVAUPUtf7Wj0Y3/hTh7DrUp+lFSZjSlVYrE+AT5kqcMCeAPObPp1W29dcTkmAvtcV3w6865FoFcm311OJK9ZRNdWBhHKXILiektNe4iz9T42ZZ5ieJjWlpvI2jL1KP/72mXTOuclXtQnTKX5CSZMC7KaxEjiq8SVTRCLLAh4B57kfr2ytUasHZQ4I3G4cz8C3h9NxPx3P87sezKPKZtLUZ/agweGKCqPMTuramOh6lvGSVTQr/MfvzlUXBAdcVZwkWYiIRulTRszREdm+1eiGeGGa3RF+jglAV1O+YvmO1orMM8G2iZzR5JHrTD+9Tj/sf44Z7kRyed/YEaUk1GzeuJHdnZ2+GkuGRumI1Jyp73J94Pz5I5VGBeqcUUXPkd97QKN9N5zlIT/+yoOas2NZTHJp+T5OhdJFaqy+EQy/wr5Pu/vg1zbUQPEtuaHbvgJuXc/1XxP8C","w":949.9999999999999,"h":454.50000000000017,"aspect":"fixed","title":"function"},{"xml":"7VlNc6M4EP01rj0lBQj8cYztZPaQ2Z3abNUeUzLIoEQgR4g4nl+/3SCMAZnYG2dmD0M+jLolIfV7PLXkEVmkb18U3SRfZcTEiNyOyEJJqau79G3BhBh5Do9GZDnyPAf+Rt7dEa9bep0NVSzTlgZy9cRCDTUEXeHDlqVzLKDufC0z9OR6J1jpGb8UsnZc5fw7WG+ggudv3hon3MX4mcm07gieVvVVeaohrYXccvn4zHbVUzOasspTj93DYntazVg8JYssYljVgT63CdfsYUND9G4hemBLdIozcnHEXIiFFFKVbcnKjaI1Nsu1ks/swOM6EzJj+0G+MqXZ29FQugcj/MJkyrTaQZW6waQKtbPlkU4q22RqbAnjcWK6GRsbzatyvO+qAQpuTBTqooHuKIyq0CzHXtFc3vGU6hjvbPHfJFLLR8Gz57wNAxmEId/yVNCMGVo8GA8GN0y4iO7pThY4z1zT8LkuzROp+HeoT2uEwK30Q8mpJSF9yNYB/rRaPmCP5lmKIR+/1di4HdNX+taqeE9zXY9SCkE3OV+V48aGKVUxz+ZSa6BwVanHk3F5mUkf2KurDkY1HRfrIZN4SMWN4HEGxpRHkbgQ0YLAEMhAOZ32eOc7Ft5NPoV3o2B+DdUAoOunTTwKlkN821AYYYtu/iDdIEjahodTXh3aZLLkJTUhF2yth5DIQT54Ft+X1ZZ+Y/nLhAxNEprjVKCYQEOWIaekppqu9sTfSJ7pMqbBHH4hygvnOigjsYCy25ThF6sroFAGc6K8BJwBO7cs1316Oc5sdnfXeddwWBHNk1IM3Q73/FMpRuwUM2gRchqlyOQzKBWxPFR8E3IJ9oih8zeITxFxfNRLMVqQ0c0Rnpm2msusTbTggsvLMRE4omHDcnIoGx9Rh1oNghPVYPxR6HrZh+nxlYqCtXOLxG2ygVa2Ee6D0iQU9dt9YLJkJbB0sat6QpiXuNgk6Gcmt/lLwVJcFsFCU8Sy+l89vkgzXCOPpC578+EMPKtIHRDkLL0yqgOGoCn9LWGEyyvvGBvtunTI4UGJOKYztXaGQDamUKyY4kALph72o3RN59+oBntWWjzH/6xFr1Ykx7/uM3vmXya/sqnQnVQla2DYOUfJmYMoOinP+BomGVG7/uQJ3bDHEDMWIKhqa9Dk1NzqAlkCcdpZgjvph494lvC5zofzhJ4yTC3K0HmLysAh9aiKTpPgO5pygbP7nYlXhszrMN2zMfr4HqDy/GPC4w3sIxp4q9GcBNdkEC63Axfpo+Xa0LoQ2TuyvK7i3ojpQhaKI52dP9i2r7F6h9jd4Bq9O2sbiA0fTbPDN2U2vFonMl0V+dkbwTWNZpF1RabMd4l3mTfP6+8DLwXde++Z6/TeKxbFrE4dIfNMZCwzKm4ba2fdaOrcy3IRwjg+Ma135rWihZbtKFfPxAe1IpYDZ8LaZGyw7YtZHUXv5MgqJqjmr+3+P0x5a/6IqT3NO2cT7uG4LMpda9cOspKolJl3iLmqYn6/2htgcxuXSPxZaMxtjjJ4QkMbg1f+OHBOTv/f2WHO2lo0s629Ywulp5+zxRxE6jGVESzJQOA2ZMPnST8OMqg2jYgNMo/4fhBdBrIp+XmY9WWI9Nb7JtM2OzpMrTL5ih/Lfk79GedM3tiegP+UI6ZLZHhT53p2cAVBiwGBM2u5+6dEZpntpn/+2XzoE8C3EcDtwWw93zGwnH+0o3G9+l+e65yG9vCZTL29fg9A7/yNfR+/wIZfP2n/hd/p+AXeD8SvfxQD+JFf+H0Av8mJAvof8INi85Vf6Wt9I/gv","w":950.0000000000002,"h":614.0000000000003,"aspect":"fixed","title":"study"},{"xml":"7ZhLc+I4EMc/jY9JyfIDOAbYzB4yu1ObrdpjStgCayNLHlkOMJ9+W7b8woJhBmpP45CK1Xq41b9/txy8YJUfPilSZJ9lSrkX/OYFKyWlbu7yw4py7mHEUi9Yexgj+PXw85lev+5FBVFUaMcEufmXJhpGcLIxD1vXnTGHscutFKZnSxJad8RfK+PFciUrxaiCrj/ovjfD3c781ccCxj+lRJMNKWm7GjyyWbAZ1fi15XLP5Ns7PTaPNnPf+pl4sBNsmuNNlvrIG9ewymS+qUpYeJ8xTV+Lxuk9xBFsmc7N3nyzKcb5SnKp6nnBlqSLNAJ7qZV8p4MeQkM/wJ2nH1RpejgbVH/g3Scqc6rVEYbYCRg9YjzDOPLjWeij2bxZYM9Sndn5FgvKKNtldtHY2kjZtHfdwj1AuLHxaJsW6bV4+yC2IE3HQ8m+GYowAIfFYUpZyPyHyAqS07dtJZIx1eAyVVmJlJqh6GfIzkjiIrsJ4wiF9yHrz9CE5Wz+v7FMaZkoViRMgj2ldae56zIIka+Vtwq8p7Ubi11AMykcdMI70gGFDBg0l4NaZH5c1OL6siu91upc+/GNFG0U5tEEYogcEGfxrRAnBdo++YPwio7zM/P7jBplbNIFpU/KANXX0OTIbM4EfWg3ZHLbN1OiaXZD3Ktc0PJsinfmoZd4rA/goccimEC1Xo9lIKSgZjBoiYkdGKK+9bcEXa0f8DnFSdCB0ThYMpamVIBtrNOUlFnd8E+0FE5VitBi8Qxcl4SzHSy1TkBQcPIFy4IqBuipeu289O3iX4gGu6gtuK4zRpssIfzJrpKDZyZI95AuDhaPU/UuwvuUIFfNeZYqJ43bJTO1ZQlFHOVMsC1sMiXuQlNmBI72BOJLQIRqXGfii3Wm3LOcE3FrwOyEOLBhaHM/fFwMrvliEszAdTb76OaCPqkFM0ctOMmpOoxGiEfI5bSW4ncK76ZR/8umM5DkfVfnxJ+VNhVhkAvPJGfcBOZ3yj+oEe1JkmBXMpw/YZuef2ws8YVT+iqy8UWyHRJLNpjmxb1esybo5hN0SVdCTxH2cq4ja3tMbUoyxtMXcpSVca3UQKptLTOp2DeTPn0xJarlgmN3De0nvZrF7GMUNW93X9rA+iemz+QwGvhCSt06KDknRck2vFVNTtSOiaXUGl4Im0F3SNIgOkHZpsKAJVQ5V1qGt8NcuGD65863sfpt4B0s2rThdKsdh4I2J1t7zL3UY9Zhb/nL7jE8e8hp89LXSamQTOg6BtESPhDOFYKDIgLHV9D2+zZ8zHAFB5+AvUB5Ns+hAH1PS30tz/nlUyq+Dh/+8Res6b+8yIVvWkp/4bsaX3Rl9t0Fn+/CF/zC9/P4HN833AsfNPvvpuq+0VdX/wE=","w":950,"h":426.0000000000002,"aspect":"fixed","title":"database"}]</mxlibrary>'
