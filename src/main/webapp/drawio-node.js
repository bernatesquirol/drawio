const xml2js = require('xml2js');
const pako = require('pako');
const _ = require('lodash');
const ROOT_ID = 1
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
    return _.map(list_nodes, (val)=>{
        let props = getProps(val)
        let rgex = />([^><]+)</g
        if (props['label']){
            let result = rgex.exec(props['label'])
            if (result.length>1)
                return result[1]
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
const modifySimpleBlock = (block_o, id=null, id_parent=null,new_title=null, x=null, y=null,width=null, height=null)=>{
    let block = JSON.parse(JSON.stringify(block_o))
    if (new_title!=null) block.object.$.label = block.object.$.label.formatUnicorn({title:new_title})
    if (width!=null) block.object.mxCell[0].mxGeometry[0].$.width = width
    if (height!=null) block.object.mxCell[0].mxGeometry[0].$.height = height
    if (x!=null) block.object.mxCell[0].mxGeometry[0].$.x = x
    if (y!=null) block.object.mxCell[0].mxGeometry[0].$.y = y
    if (id!=null) block.object.$.id = id
    if (id_parent!=null) block.object.mxCell[0].$.parent=id_parent
    return block
}
const getGeoSimpleBlock = (block_o)=>{
     return {...block_o.object.mxCell[0].mxGeometry[0].$}
}
//modifySimpleBlock(input[0],'id-input','parent_id', 1,2,4,5)
const createMinimizedFunctionCell = (basics_lib, inputs, outputs, function_id, function_name, top_padding=10, padding_side=10)=>{
    let function_promise = getSimpleBlockFromLibrary(basics_lib, 'function')
    let input_promise = getSimpleBlockFromLibrary(basics_lib, 'input')
    let output_promise = getSimpleBlockFromLibrary(basics_lib, 'output')
    return Promise.all([function_promise,input_promise,output_promise]).then(function(result){

        let func = result[0][0]
        let geo_func = getGeoSimpleBlock(func)
        let input = result[1][0]
        let geo_input = getGeoSimpleBlock(input)
        let output = result[2][0]
        let geo_output = getGeoSimpleBlock(output)
        let func_block = modifySimpleBlock(func,id=function_id, id_parent=ROOT_ID, function_name)
        let input_blocks = inputs.map((input_text, index)=>(modifySimpleBlock(block_o=input,id=input_text,id_parent=function_id, input_text, x=padding_side, y=index*Number(geo_input.height)+top_padding)))
        let output_blocks = outputs.map((output_text, index)=>(modifySimpleBlock(block_o=output,id=output_text,id_parent=function_id, output_text, x=geo_func.width-padding_side-geo_output.width, y=index*Number(geo_output.height)+top_padding)))
        return [func_block].concat(input_blocks).concat(output_blocks)
    })
}
const getDiagram = (array_obj)=>{
  return {'mxGraphModel':{'root':[{..._.groupBy(array_obj, Object.keys),'mxCell':[{$: {id: "0"}},{$: {id: ROOT_ID, parent: "0"}}]}]}}

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
  getDiagram:getDiagram
}
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
