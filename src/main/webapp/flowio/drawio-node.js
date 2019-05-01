const _ = require('./lodash');
const xml2js = require('./xml2js/xml2js');
const pako = require('./pako');
const ROOT_ID = 1
const fs = require('fs')
//stackoverflow
String.prototype.formatUnicorn = function (){
  var d=this.toString();
  if(!arguments.length)return d;
  var a=typeof arguments[0],a="string"==a||"number"==a?Array.prototype.slice.call(arguments):arguments[0],c;for(c in a)d=d.replace(RegExp("\\{"+c+"\\}","gi"),a[c]);return d}
  const compress = function(a, c) {
      if (null == a || 0 == a.length || "undefined" === typeof pako)
          return a;
      var d = bytesToString(pako.deflateRaw(encodeURIComponent(a)));
      return encode(d)
}

const encode = function(text){
  return Buffer.from(text, 'binary').toString('base64')
}
const decode = function(text){
  return Buffer.from(text, 'base64')
  }
const decompress = function(a, c) {
    if (null == a || 0 == a.length || "undefined" === typeof pako)
        return a;
    var d = decode(a);
    return zapGremlins(decodeURIComponent(bytesToString( pako.inflateRaw(d))))
}
const zapGremlins = function(a) {
    for (var c = [], d = 0; d < a.length; d++) {
        var b = a.charCodeAt(d);
        (32 <= b || 9 == b || 10 == b || 13 == b) && 65535 != b && c.push(a.charAt(d))
    }
    return c.join("")
}
const bytesToString = function(a) {
    for (var c = Array(a.length), d = 0; d < a.length; d++)
        c[d] = String.fromCharCode(a[d]);
    return c.join("")
}


const getChildren = function(root){
  let values = Object.values(root)[0]
  let children = values.$$
  if (children==null) return null
  let real_children = []
  Object.keys(children).forEach((nodeType)=>{
    children[nodeType].forEach((real_child)=>{
      let obj = {}
      obj[nodeType]={...real_child}
      real_children.push(obj)
    })
  })
  return real_children
}

const getProps = function(root){
  let values = Object.values(root)[0]
  if (Array.isArray(values)){
    return values[0].$
  }
  return values.$

}
const findChildren = function(root, obj_filter){
  if (root==null) return null
  let props = getProps(root)
  if (props!=null){
    if (_.reduce(obj_filter,(result, value, key) =>
  (result && props[key]==value),true)) {
    return root
  }
  }
  let children = getChildren(root)

  if (children==null || children.length<1) return null
  let return_value = _.flatMap(children,(child)=>findChildren(child,obj_filter)).filter((child)=>child!=null)
  return return_value
}



const parseString = function(stringToParse, args_parser={}){
    return new Promise(function(resolve, reject){
        let parser = new xml2js.Parser(args_parser);
        parser.parseString(stringToParse,function(err, result){
         if(err){
             reject(err);
         }
         else {
             resolve(result);
         }
        })
    })
}
const toString = function(xml_obj, builder_opts={}){
    let builder = new xml2js.Builder(builder_opts);
    return builder.buildObject(xml_obj);
}
const getClearLabels = function(list_nodes){
    if (list_nodes == null) return []
    return _.map(list_nodes, (val)=>{
        let props = getProps(val)
        let rgex = />([^><]+)</g
        //console.log(props)
        if (props['label']){
            let result = rgex.exec(props['label'])
            if (result!=null && result.length>1) return result[1]
            else return props['label']
        }
        return null
    }).filter((val)=>(val!=null))
}
//parseString(file)
/*let parser = new xml2js.Parser();
let children = []
let result = await parseString(file)
let compressed = result['mxfile']['diagram'][0]._;
let result_decompressed = await parseString(decompress(compressed),{'explicitChildren':true})
children=findChildren(result_decompressed, {'key_flowio':'input'})*/
//getClearLabels(children)

const getSimpleBlockFromLibrary = function(library, title){
    return parseString(library).then((lib_xml)=>{
        let list_blocks = (lib_xml).mxlibrary
        return Promise.all(JSON.parse(list_blocks).filter((block)=>(block.title==title)).map((obj)=>(parseString(decompress(obj.xml)).then((decompressed_block)=>{
        let obj_val = decompressed_block.mxGraphModel.root[0].object[0]
        //cleaning upper layers
            return {'object':obj_val}
        })
        )))
    })
}
//let input = ((await getSimpleBlockFromLibrary(basics, 'input'))[0])
const modifySimpleBlock = (block_o, id=null, id_parent=null,new_title=null, x=null, y=null,width=null, height=null, flowio_id=null)=>{
    let block = JSON.parse(JSON.stringify(block_o))
    if (new_title!=null) block.object.$.label = block.object.$.label.formatUnicorn({title:new_title})
    if (width!=null) block.object.mxCell[0].mxGeometry[0].$.width = width
    if (height!=null) block.object.mxCell[0].mxGeometry[0].$.height = height
    if (x!=null) block.object.mxCell[0].mxGeometry[0].$.x = x
    if (y!=null) block.object.mxCell[0].mxGeometry[0].$.y = y
    if (id!=null) block.object.$.id = id
    if (flowio_id!=null) block.object.$.flowio_id = flowio_id
    if (id_parent!=null) block.object.mxCell[0].$.parent=id_parent
    return block
}
const getGeoSimpleBlock = (block_o)=>{
     return {...block_o.object.mxCell[0].mxGeometry[0].$}
}
const guidGenerator = ()=>{
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+"-"+S4()+"-"+S4()+"-"+S4());
}

//modifySimpleBlock(input[0],'id-input','parent_id', 1,2,4,5)
const createMinimizedFunctionCell = (basics_lib_path, inputs, outputs, flowio_id, function_name, top_padding=10, padding_side=20)=>{
    let basics_lib = getBasics(basics_lib_path)
    let function_promise = getSimpleBlockFromLibrary(basics_lib, 'function')
    let input_promise = getSimpleBlockFromLibrary(basics_lib, 'input')
    let output_promise = getSimpleBlockFromLibrary(basics_lib, 'output')
    return Promise.all([function_promise,input_promise,output_promise]).then(function(result){
        let real_func_id = 'function'-guidGenerator()
        //function_id+'-function-'+Date.now()
        let func = result[0][0]
        let geo_func = getGeoSimpleBlock(func)
        let input = result[1][0]
        let geo_input = getGeoSimpleBlock(input)
        let output = result[2][0]
        let geo_output = getGeoSimpleBlock(output)
        
        let input_blocks = inputs.map((input_text, index)=>(modifySimpleBlock(block_o=input,id='input-'+guidGenerator(),id_parent=real_func_id, input_text, x=padding_side, y=index*(Number(geo_input.height)+top_padding)+top_padding)))
        let output_blocks = outputs.map((output_text, index)=>(modifySimpleBlock(block_o=output,id='output-'+guidGenerator(),id_parent=real_func_id, output_text, x=geo_func.width-padding_side-geo_output.width, y=index*(Number(geo_output.height)+top_padding)+top_padding)))
        let func_block = modifySimpleBlock(func,id=real_func_id, id_parent=ROOT_ID, function_name, x=null, y=null, width=null, height=(Number(geo_output.height)+top_padding)*Math.max(inputs.length, outputs.length)+top_padding, flowio_id=flowio_id)
        return [func_block].concat(input_blocks).concat(output_blocks)
    })
}
const groupBy_values = (array, func)=>{
  let groupby_val = _.groupBy(array,func)
  return Object.keys(groupby_val).reduce((final_object, key, index, array)=>{
    let values_key = groupby_val[key].map((obj)=>obj[key])
    final_object[key]=values_key
    return final_object
  },{})
}
const getDiagram = (array_obj)=>{
  return {'mxGraphModel':{'root':[{...groupBy_values(array_obj, Object.keys),'mxCell':[{$: {id: "0"}},{$: {id: ROOT_ID, parent: "0"}}]}]}}

}

const getBasics = (basics_file_path)=>{
  return fs.existsSync(basics_file_path)?fs.readFileSync(basics_file_path):basics
}
module.exports={
  //encode: encode,
  //decode: decode,
  decompress:decompress,
  compress:compress,
  parseString:parseString,
  toString: toString,
  getSimpleBlockFromLibrary: getSimpleBlockFromLibrary,
  getClearLabels:getClearLabels,
  modifySimpleBlock:modifySimpleBlock,
  createMinimizedFunctionCell:createMinimizedFunctionCell,
  findChildren:findChildren,
  getDiagram:getDiagram,
  getBasics:getBasics
}
const basics = '<mxlibrary>[{"xml":"dVJNc4IwEP01HO1AouC1QvXSnjz02ImwSGpgaQgF++u7CUF0pj0w7Mt7efuRDXhajwct2uoNC1ABfwl4qhHNFNVjCkoFLJRFwLOAsZC+gO3/YSPHhq3Q0Jg/LuDpE3JDCiVONlnmyFiRdldiY5nOXBU4Jv7qcSZWnfyh02cSRKwdF5Kis/snOyMN3Uyy2ZCyTp5e4UorFQ4SPy5wnbLLpu3NRM1NMAsf+1uKYhr7pgArDcl0qKSBYytyyw40RjqrTG1bi3zpe1FLZbO99rksBLml2HRo/Rx/dJ1l0ZawUPLcEMhpfKDpoDMaL5CiQu3S8yI+xZv4xrzLwlRzMqnUnbIsS5bnt8a/QRsY/32m6K7pA2ANRl9J4i+wJ5bwhMfJZr3mjLMwhlXEJ5fBl0BoOz12WIE8V97YL0Aougmfb+bLWlDgRz1DvygzXBbSSR/29Rc=","w":80,"h":20,"aspect":"fixed","title":"input"},{"xml":"dVJNb4MwDP01OU4KQYPuuMLay3bqYccpBReyBsxCGHS/fk4IpZU2pAjb7/nbLM6aaW9kV79hCZrFLyzODKKdpWbKQGsmuCpZnDMhOD0mdv+gkUd5Jw209g8HPH5CYYmh5dElyz2YaOJuT9g6pLcXDR5JvgZcgIde/ZD1mQiR6KYVJKny/3RrlSXPNF8CUtY5ZmD40k4aR4UfZ7jM2XGw3WBnbOlCOPW+wbUqYXBoS3BUTlHHWlk4dLJw6EhzJFttG9dbFGrfyUZpl+51KFQpKVqGbY8unscPvrU82gQ9Q43G54q5/8gutapashU0VyBw21uDZ7ihPiVpLJMr8q5KWy9FKK1vmBCVj5BeJ/INxsL07/6im2HsARuw5kKUMcQndDOvmNegqjp4hbVz2c96dfVcj4GEMN9FDeexqOsZeurdlf4C","w":80,"h":20,"aspect":"fixed","title":"output"},{"xml":"dVNLU4NADP41HHXobgv1aFsfB51x9ODR2UIKqwvBJbWtv94ElhademBI8uX5JRvpZbW/86YpHzEHF+mbSC89IvVStV+Cc5GKbR7pVaRUzF+kbv9BJx0aN8ZDTWcCcP0OGbGHM2spturAxLHvYoO1IC0dHHRI8rmVNhbO1nBRgi1K1q7ZZcY5ZyecpaL7pwuyxMHpasjJhfu0waPrbuNwZ/HtAw59A5ttnZHFukeHUZSov6c8taa+wJPNjHuQOZ6wtV0CvVojEVZcanC4drYQgLBha0mVTD1hsSWPH/BqcyoHS2kaSd94zKBt2bIrLcFLYzIx73hJbPO4rXPIhxj7LVh8GSeJnqirq1RP0+k8Fsz47KWHE6HXOrdEh74bQOczmOfTYx8jZK7WOpGIjJkzzL0PtYTJW1NZJ7zdg/sCmfBIq0wM+3/vYDLi8w6wAvIHdtkFAoTxpL+VeNi1GNNgM22vF8fQY7ZnPilTF7waFYf6WoewsGI1Dfqo3PxMNfWnmnEEvjYEC2G9HZ8yC6NBTqbuVgY13Pugnt5VHz1+dj8=","w":260,"h":70,"aspect":"fixed","title":"function"}]</mxlibrary>'
/*

let final_func = await createMinimizedFunctionCell(['a1','a2','a3'],['b1','b2'],'function_id')
//"Hello, {name}, are you feeling {adjective}?".formatUnicorn({name:"Gabriel", adjective: "OK"})


let prova = "7ZZRb9owEMc/TR47JTZx4LHA2j100rQ+7LEyjkO8OnHmOAX26XfnOBBa2Do0bZrUSAjf/e073/lnSEQX1fbW8qb8aHKpI/o+ogtrjOtH1XYhtY5IrPKILiNCYvhE5OaMmng1briVtTuxwKy+SuFghuYrTLb0ItMwd16YGpXW7bT0CvvW4TbmWtXyqpRqXYJ1DVNSiJkedBit/Xc2d8rB4mw5xITEfdgww+/uUe4eBO7bpy+6Wjhl6l4bCiFoHtd42Bh5ktYpwfUdVvHJtMoHoMuVcc5UkGiYcK3VGgVnGvCWrsKkCQxbZ82j/KJyVw6ekjcYvrFGyLYFz6ZUTt43XKB7A0cEPmu6Opf5sEZ9Ry1+FzNGEzKbZXSSTaYxatyK+15m2Fyl9cJoY30BNE/lNJ/s9zFSpmRFGa4Q0DcOnbchF/bxhldK78DxQeoniRXum4oVy+1ZCpJRP2+lqaSzO5iyCQ3AjrOelHg4aXRmwcfb3l7vl+6jfQageL2GoyFxyE9pWLYLoSfBHqWbnshGnmXj2klbcyfn2PV2DDIMRoUcXJ6VwQy0X04+Clf9ISP3CWm2l2NfaLNR5gHo77ObzjWdO8ae/hT7A3zxGTxHhB/xctcJlXOItjB1azCe1wOgyTTYIw5j/yDH4QoJYAlhfInsjGWUs5OX6hn2MgHws9cyS04zuz2GJXQzuQyxMdBHbP1HIKn6BUeTf8fRr3nJ2Yqlr+KlKAoixJ/hJWHwMz16+rv2xs9JftI3fn6TH5r+JX7APLwe9n+D47fHHw=="
let real = await parseString(decompress(prova))
compress(toString(real,{'renderOpts':{'pretty':false},'headless':true})
decompress(prova)
//compress(toString(real,{'minified':true}))
let mxGraph = {'mxGraphModel':{'root':[{..._.groupBy(final_func, Object.keys),'mxCell':[{$: {id: "0"}},{$: {id: "1", parent: "0"}}]}]}}
compress(toString(mxGraph,{headless:true}))
toString(mxGraph,{headless:true});
compress(toString(real,{headless:true}))
*/
