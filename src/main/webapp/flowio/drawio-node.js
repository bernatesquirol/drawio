const _ = require('./lodash');
const xml2js = require('./xml2js/xml2js');
const pako = require('./pako');
const ROOT_ID = 1
const fs = require('fs')

/**
 * Encodes a graph to a base64 compressed text
 * @param  {String} graph_string graph string to encode in base64, typically: <mxGraphModel><root>...</mxGraphModel
 * @return {String}              decoded text
 */
const encode = function(graph_string){
  return Buffer.from(graph_string, 'binary').toString('base64')
}
/**
 * Decodes a a text from base64 to plain text
 * @param  {String} base64_text text to encode in base64, typically: ASDFIEWQRNFSDVAFHDSA=
 * @return {String}             encoded text
 */
const decode = function(base64_text){
  return Buffer.from(base64_text, 'base64')
}
/**
 * decompress: extracted from drawio JS files
 */
const decompress = function(a, c) {
    if (null == a || 0 == a.length || "undefined" === typeof pako)
        return a;
    var d = decode(a);
    return zapGremlins(decodeURIComponent(bytesToString( pako.inflateRaw(d))))
}
/**
 * compress: extracted from drawio JS files
 */
const compress = function(a, c) {
  if (null == a || 0 == a.length || "undefined" === typeof pako)
      return a;
  var d = bytesToString(pako.deflateRaw(encodeURIComponent(a)));
  return encode(d)
}
/**
 * zapGremlins: extracted from drawio JS files
 */
const zapGremlins = function(a) {
    for (var c = [], d = 0; d < a.length; d++) {
        var b = a.charCodeAt(d);
        (32 <= b || 9 == b || 10 == b || 13 == b) && 65535 != b && c.push(a.charAt(d))
    }
    return c.join("")
}
/**
 * bytesToString: extracted from drawio JS files
 */
const bytesToString = function(a) {
    for (var c = Array(a.length), d = 0; d < a.length; d++)
        c[d] = String.fromCharCode(a[d]);
    return c.join("")
}

/**
 * Gets children from a given mx_obj
 * @param  {Object} mx_obj {mxObject: {$:{...},mxType1:[{...}, {...}]}
 * @return {Array[Object]}        [{mxType1:{...}},{mxType1:{...}},{mxType2:{...}},...]
 */
const getChildren = function(mx_obj){
  //seleccionem {$:{...},mxType:[ Object object ], ...}
  let values = Object.values(mx_obj)[0]
  //seleccionem {mxType:[ Object object ], ...}
  let children = Object.keys(values).filter((key)=>key!='$')
  if (children==null) return null
  let real_children = []
  children.forEach((nodeType)=>{
    //if(!Array.isArray(values[nodeType])) console.log(mx_obj)
    // iterem per l'array d'objectes i retornem cada item individualment
    // (desagrupemBy el tipus)
    values[nodeType].forEach((real_child)=>{
      let obj = {}
      //{mxType:{...}}
      obj[nodeType]={...real_child}
      real_children.push(obj)
    })
  })
  return real_children
}
/**
 * Gets props ($) from a given mx_obj
 * @param  {Object} mx_obj {mxObject: {$:{...},mxType1:[{...}, {...}]}
 * @return {Object}        {...}
 */
const getProps = function(mx_obj){
  let values = Object.values(mx_obj)[0]
  if (Array.isArray(values))console.log('NO EH!!!!')
  return values.$
}

/**
 * Recursive method to get the children of an mx_object, props of whom satisfy the filter_func
 * @param  {Object} mx_obj {mxObject: {$:{...},mxType1:[{...}, {...}]}
 * @param  {function} filter_func function(props){ return true/false }, 
 *                           returns true or false given the props of the item 
 * @return {Array[Object]}        [{mxType1:{...}},{mxType1:{...}},{mxType2:{...}},...]
 */
const findChildren = function(mx_obj, filter_func){
  if (mx_obj==null) return null
  let props = getProps(mx_obj)
  if (props!=null){
    if (filter_func==null | filter_func(props)) {
      return [mx_obj]
    }
  }
  let children = getChildren(mx_obj)
  if (children==null || children.length<1) return null
  // flatmap fa un map (executa per tot item d'un array) i un flatten (es carrega les llistes de llistes)
  let return_value = _.flatMap(children,(child)=>findChildren(child,filter_func)).filter((child)=>child!=null)
  return return_value
}

/**
 * findChildren with given properties
 * @param  {Object} mx_obj {mxObject: {$:{...},mxType1:[{...}, {...}]}
 * @param  {Object} obj_filter {key:value,...} all the desired key_value pairs the block props have to satisfy
 * @return {Array[Object]}        [{mxType1:{...}},{mxType1:{...}},{mxType2:{...}},...]
 */
const findChildrenValueFilter = function(mx_obj, obj_filter={}){
  return findChildren(mx_obj, (props)=>_.reduce(obj_filter,(result, value, key) =>
  (result && props[key]==value),true))
}

/**
 * Get the edges from/to to certain blocks
 * @param  {Object} mx_obj {mxObject: {$:{...},mxType1:[{...}, {...}]}
 * @param  {Array[Object]} all_blocks the blocks where the edges will begin or end
 * @param  {String} edge_origin can be either 'target' or 'source'
 * @return {Array[Object]}        [{mxType1:{...}},{mxType1:{...}},{mxType2:{...}},...]       
 */
const findEdges=(mx_obj,all_blocks,edge_origin='target')=>{
  let all_ids = all_blocks.map((block)=>{
    return Object.values(block)[0].$.id
  })
  //la funcio que filtre els edges
  let filter_edges = (all_ids)=>{
    return function(props){
      return props[edge_origin]!=null && all_ids.includes(props[edge_origin]) //|| all_ids(props.source==id_to_find)
    }
  }
  let edges = findChildren(mx_obj, filter_edges(all_ids))
  return edges
}
/**
 * Get the blocks and the edges given a list of object_filters
 * @param  {Object} mx_obj {mxObject: {$:{...},mxType1:[{...}, {...}]}
 * @param  {Array[Object]} list_of_filters list of objects of filters (filter1 OR filter2)
 * @param  {String} edge_origin can be either 'target' or 'source'
 * @return {Array[Object],Array[Object]}        blocks, edges       
 */
const findAllAndEdges=(mx_obj, list_of_filters, edge_origin='target')=>{
  let all_blocks = list_of_filters.map((filter)=>{
    return findChildrenValueFilter(mx_obj,filter)
  }).flat()
  let edges = findEdges(mx_obj,all_blocks,edge_origin)
  return [all_blocks,edges]
}

/**
 * Gets Promise(mxObj) from text (contrary to toString)
 * @param  {String} stringToParse '<mxGraphModel><root>...'
 * @param  {Object} args_parser arguments parser (xml2js)
 * @return {Promise}         {mxGraphModel: {$:{...},root:[{...}, {...}]} result of the parse     
 */
const parseStringDrawio = function(stringToParse, args_parser={}){
    return new Promise(function(resolve, reject){
        let parser = new xml2js.Parser(args_parser);
        parser.parseString(stringToParse,function(err, result){
          if(err) reject(err);
          else resolve(result);
        })
    })
}

/**
 * Gets text from mxObject (contrary to parseStringDrawio)
 * @param  {Object} mxObj {mxGraphModel: {$:{...},root:[{...}, {...}]}
 * @param  {Object} builder_opts arguments builder (xml2js)
 * @return {String}         '<mxGraphModel><root>...'    
 */
const toString = function(mx_obj, builder_opts={}){
    let builder = new xml2js.Builder(builder_opts);
    return builder.buildObject(mx_obj);
}

/**
 * Clears text string from style extras
 * @param  {String} stringToClear '<bold><thing>tal</bold></thing>'
 * @return {String}         'tal'    
 */
const clearText=(stringToClear)=>{
  let rgex = />([^><]+)</g
  let result = rgex.exec(stringToClear)
  if (result!=null && result.length>1) return result[1]
  return stringToClear
}
/**
 * Clears text string from style extras
 * @param  {Array[Object]} list_nodes {mxType:{$:{label:''}}},...
 * @return {String}         list of cleared labels    
 */
const getClearLabels = function(list_nodes){
    if (list_nodes == null) return []
    return _.map(list_nodes, (val)=>{
        let props = getProps(val)
        return clearText(props['label'])
    }).filter((val)=>(val!=null))
}

/**
 * Clears text string from style extras
 * @param  {String} label '<bold><thing>tal</bold></thing>'
 * @param  {String} new_label new_tal
 * @return {String}         '<bold><thing>new_tal</bold></thing>'
 */
const formatLabel=(label, new_label)=>{
  if (label == null) return new_label
  let matches = label.match(/\<(.*?)\>/g)
  return matches?matches.slice(0,matches.length/2).join('')+new_label+matches.slice(matches.length/2).join(''):new_label
}


/**
 * Gets Promise(block) from library given title
 * @param  {String} library '<mxLibrary>...'
 * @param  {String} title key for block in library
 * @param  {String} type type of block: default object (please, any block create objects, adding a flowio_key in the data)
 * @return {Array[Promise]}  can be more than 1    
 */
const getSimpleBlockFromLibrary = function(library, title, type='object'){
    return parseStringDrawio(library).then((lib_xml)=>{
        let list_blocks = (lib_xml).mxlibrary
        return Promise.all(JSON.parse(list_blocks).filter((block)=>(block.title==title))
                  .map((obj)=>(parseStringDrawio(decompress(obj.xml)).then((decompressed_block)=>{
                    let obj_val = decompressed_block.mxGraphModel.root[0][type][0]
                    //cleaning upper layers
                    let return_obj = {}
                    return_obj[type]=obj_val
                    return return_obj
        })
        )))
    })
}


/*
 * Modifies a 'simpleblock': object -> mxCell's[0] -> mxGeometry's[0]
 * @param  {Object} {object:{mxcell:[{mxgeometry:[{}]}}]}
 * @param  {String} id of the simpleblock
 * @param  {String} id_parent of the simpleblock
 * @param  {String} new_title of the simpleblock
 * @param  {String} x of the simpleblock
 * @param  {String} y of the simpleblock
 * @param  {String} width of the simpleblock
 * @param  {String} height of the simpleblock 
 * @param  {String} flowio_id of the flowio_id
 * @return {Object} {object:{mxcell:[{mxgeometry:[{}]}}]} (all copied)
 */
const modifySimpleBlock = (block_o, id=null, id_parent=null,new_title=null, x=null, y=null,width=null, height=null, flowio_id=null)=>{
    let block = JSON.parse(JSON.stringify(block_o))
    if (Object.keys(block).includes('mxCell')){
      if (!Array.isArray(block['mxCell'])){
        block['mxCell']=[block['mxCell']]
      }
      block={'object':{...block,$:{}}}
    }
    if (!Object.keys(block).includes('object')) return block
    if (new_title!=null) block.object.$.label = formatLabel(block.object.$.label,new_title)
    console.log(new_title, block.object.$.label)
    if (width!=null) block.object.mxCell[0].mxGeometry[0].$.width = width
    if (height!=null) block.object.mxCell[0].mxGeometry[0].$.height = height
    if (x!=null) block.object.mxCell[0].mxGeometry[0].$.x = x
    if (y!=null) block.object.mxCell[0].mxGeometry[0].$.y = y
    if (id!=null) block.object.$.id = id
    if (flowio_id!=null) block.object.$.flowio_id = flowio_id
    if (id_parent!=null) block.object.mxCell[0].$.parent=id_parent
    return block
}

/*
 * Gets geometry object {x,y,width,height} from a 'simpleblock': object -> mxCell's[0] -> mxGeometry's[0]
 * @param  {Object} {object:{mxcell:[{mxgeometry:[{}]}}]}
 * @return {Object} x, y, width, height to int
 */
const getGeoSimpleBlock = (block)=>{
  return {
    x:parseInt(block.object.mxCell[0].mxGeometry[0].$.x),
    y:parseInt(block.object.mxCell[0].mxGeometry[0].$.y),
    width:parseInt(block.object.mxCell[0].mxGeometry[0].$.width),
    height:parseInt(block.object.mxCell[0].mxGeometry[0].$.height)
  }
}
/*
 * Removes anchor points of edge
 * @param  {Object} {mxcell:[{mxgeometry:[{}]}}
 * @return {Object} x, y, width, height to int
 */
const removeEdgePoints = (edge)=>{
  let new_edge = JSON.parse(JSON.stringify(edge))
  new_edge.mxCell.mxGeometry[0]={$:new_edge.mxCell.mxGeometry[0].$}
  return new_edge
}
/*
 * Changes xml2js children explicit to not explicit
 * @param  {Object} mxobj
 * @return {Object} mxobj
 */
const explicitChildrenToNot=(obj)=>{
  let new_obj = {$:obj.$}
  if (obj.$$!=null){
    Object.keys(obj.$$).forEach((child_key)=>{
      new_obj[child_key]=obj.$$[child_key].map((val)=>explicitChildrenToNot(val))
    })
  }
  return new_obj
}


const groupBy_values = (array, func)=>{
  let groupby_val = _.groupBy(array,func)
  return Object.keys(groupby_val).reduce((final_object, key, index, array)=>{
    let values_key = groupby_val[key].map((obj)=>obj[key])
    final_object[key]=values_key
    return final_object
  },{})
}

const openDiagram = (path, opts={})=>{
  return fs.promises.readFile(path,'utf8').then((data)=>{
    return drawionode.parseStringDrawio(data).then((data_value)=>{
      let compressed = data_value['mxfile']['diagram'][0]._;
      return drawionode.parseStringDrawio(drawionode.decompress(compressed),opts)
    })
  })
}

const getDiagram = (array_obj, root_id)=>{
  let root = {'mxCell':[],...groupBy_values(array_obj, Object.keys)}
  console.log(root['mxCell'])
  root['mxCell']=[...root['mxCell'],{$: {id: "0"}},{$: {id: root_id, parent: "0"}}]
  return {'mxGraphModel':{'root':root}}

}



module.exports={
  //encode: encode,
  //decode: decode,
  decompress:decompress,
  compress:compress,
  parseStringDrawio:parseStringDrawio,
  toString: toString,
  getSimpleBlockFromLibrary: getSimpleBlockFromLibrary,
  getClearLabels:getClearLabels,
  modifySimpleBlock:modifySimpleBlock,
  findChildren:findChildren,
  findChildrenValueFilter:findChildrenValueFilter,
  getDiagram:getDiagram,
  getGeoSimpleBlock:getGeoSimpleBlock,
  //findRelated:findRelated,
  findAllAndEdges:findAllAndEdges,
  clearText:clearText,
  findEdges:findEdges,
  removeEdgePoints:removeEdgePoints
}

/*

let final_func = await createMinimizedFunctionCell(['a1','a2','a3'],['b1','b2'],'function_id')
//"Hello, {name}, are you feeling {adjective}?".formatUnicorn({name:"Gabriel", adjective: "OK"})


let prova = "7ZZRb9owEMc/TR47JTZx4LHA2j100rQ+7LEyjkO8OnHmOAX26XfnOBBa2Do0bZrUSAjf/e073/lnSEQX1fbW8qb8aHKpI/o+ogtrjOtH1XYhtY5IrPKILiNCYvhE5OaMmng1briVtTuxwKy+SuFghuYrTLb0ItMwd16YGpXW7bT0CvvW4TbmWtXyqpRqXYJ1DVNSiJkedBit/Xc2d8rB4mw5xITEfdgww+/uUe4eBO7bpy+6Wjhl6l4bCiFoHtd42Bh5ktYpwfUdVvHJtMoHoMuVcc5UkGiYcK3VGgVnGvCWrsKkCQxbZ82j/KJyVw6ekjcYvrFGyLYFz6ZUTt43XKB7A0cEPmu6Opf5sEZ9Ry1+FzNGEzKbZXSSTaYxatyK+15m2Fyl9cJoY30BNE/lNJ/s9zFSpmRFGa4Q0DcOnbchF/bxhldK78DxQeoniRXum4oVy+1ZCpJRP2+lqaSzO5iyCQ3AjrOelHg4aXRmwcfb3l7vl+6jfQageL2GoyFxyE9pWLYLoSfBHqWbnshGnmXj2klbcyfn2PV2DDIMRoUcXJ6VwQy0X04+Clf9ISP3CWm2l2NfaLNR5gHo77ObzjWdO8ae/hT7A3zxGTxHhB/xctcJlXOItjB1azCe1wOgyTTYIw5j/yDH4QoJYAlhfInsjGWUs5OX6hn2MgHws9cyS04zuz2GJXQzuQyxMdBHbP1HIKn6BUeTf8fRr3nJ2Yqlr+KlKAoixJ/hJWHwMz16+rv2xs9JftI3fn6TH5r+JX7APLwe9n+D47fHHw=="
let real = await parseStringDrawio(decompress(prova))
compress(toString(real,{'renderOpts':{'pretty':false},'headless':true})
decompress(prova)
//compress(toString(real,{'minified':true}))
let mxGraph = {'mxGraphModel':{'root':[{..._.groupBy(final_func, Object.keys),'mxCell':[{$: {id: "0"}},{$: {id: "1", parent: "0"}}]}]}}
compress(toString(mxGraph,{headless:true}))
toString(mxGraph,{headless:true});
compress(toString(real,{headless:true}))
*/
/*

String.prototype.formatUnicorn = function (){
  var d=this.toString();
  if(!arguments.length)return d;
  var a=typeof arguments[0],a="string"==a||"number"==a?Array.prototype.slice.call(arguments):arguments[0],c;for(c in a)d=d.replace(RegExp("\\{"+c+"\\}","gi"),a[c]);return d}

 */