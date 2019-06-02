const _ = require('lodash');
const xml2js = require('xml2js');
const pako = require('pako');
const ROOT_ID = 1
const fs = require('fs')



class mxObject extends Object {
  constructor(obj, type) {
    super()
    obj && Object.assign(this, obj);
    this['_type']=Object.keys(obj)[0]
    this['_isSimpleBlock']=obj.object!=null&&obj.object.mxCell!=null&&obj.object.mxCell[0].mxGeometry!=null&&obj.object.mxCell[0].mxGeometry[0]!=null
    this['_isEdge']=obj.mxCell!=null&&obj.mxCell.mxGeometry!=null&&obj.mxCell.$.source!=null&&obj.mxCell.$.target!=null
    if(this['_isSimpleBlock']){
      let geo = this.object.mxCell[0].mxGeometry[0]
      if(geo.$.x==null) geo.$.x=0
      if(geo.$.y==null) geo.$.y=0
      this.object.mxCell[0].mxGeometry[0].$ = {
        ...geo.$,
        x:parseInt(geo.$.x),
        y:parseInt(geo.$.y),
        width:parseInt(geo.$.width),
        height:parseInt(geo.$.height),
      }
    }
  }
  getType(){
    return this['_type']
  }
  /**
   * Gets props ($) from a given mx_obj
   * @param  {Object} mx_obj {mxObject: {$:{...},mxType1:[{...}, {...}]}
   * @return {Object}        {...}
   */
  getProps(){
    return this[this.getType()]['$']
  }
  getOriginal(){
    let obj = {}
    obj[this.getType()]=this[this.getType()]
    return obj
  }
  getChildren(){
    let mx_obj = this.getOriginal()
    let values = Object.values(mx_obj)[0]
    if (values==null) return null
    let real_children = []
    return Object.keys(values).filter((key)=>key!='$').reduce((agg,nodeType)=>{
      return [...agg,...values[nodeType].map((real_child)=>{
        let obj = {}
        obj[nodeType]={...real_child}
        return new mxObject(obj)
      })]
    },[])
  }
  changeProp(key, value){
    this[this.getType()].$[key]=value
  }

  changeParent(parent_id){
    if (this['_isSimpleBlock']) this.object.mxCell[0].$.parent=parent_id
    //else
  }
  changeGeometrySimpleBlock(key, value){
    //key: x, y, width, height
    if (this['_isSimpleBlock']) this.object.mxCell[0].mxGeometry[0].$[key]=value

  }
  changeStyle(new_style){
    if (this['_isSimpleBlock']) this.object.mxCell[0].$.style=new_style
    if(this['_isEdge']) this.mxCell.$.style=new_style
  }
  getStyle(){
    if (this['_isSimpleBlock']) return this.object.mxCell[0].$.style
    if(this['_isEdge']) return this.mxCell.$.style

  }
  getGeometry(){
    if (this['_isSimpleBlock']) return this.object.mxCell[0].mxGeometry[0].$
    return null
  }
  /**
   * Recursive method to get the children of an mx_object, props of whom satisfy the filter_func: the children is given by key-value pairs not like in xml2js
   * @param  {function} filter_func function(props){ return true/false },
   *                           returns true or false given the props of the item
   * @return {Array[Object]}        [{mxType1:{...}},{mxType1:{...}},{mxType2:{...}},...]
   */
  findChildrenRecursive(filter_func){
    let mx_obj = this
    let props = mx_obj.getProps()

    if (props!=null){
      if (filter_func==null | filter_func(props)) {
        return [mx_obj]
      }
    }
    let children = mx_obj.getChildren()
    if (children==null || children.length<1) return null
    // flatmap fa un map (executa per tot item d'un array) i un flatten (es carrega les llistes de llistes)
    let return_value = _.flatMap(children,(child)=>child.findChildrenRecursive(filter_func)).filter((child)=>child!=null)
    return return_value
  }

  /**
   * findChildren with given properties
   * @param  {Object} obj_filter {key:value,...} all the desired key_value pairs the block props have to satisfy
   * @return {Array[Object]}        [{mxType1:{...}},{mxType1:{...}},{mxType2:{...}},...]
   */
  findChildrenRecursiveObjectFilter(obj_filter={}){
    return this.findChildrenRecursive((props)=>_.reduce(obj_filter,(result, value, key) =>
    (result && props[key]==value),true))
  }
  findChildrenRecursiveObjectFilters(obj_filters=[]){
    return this.findChildrenRecursive((props)=>_.reduce(obj_filters,(result, obj_filter)=>{
      let val_this_filter = _.reduce(obj_filter,(result, value, key) =>
    (result && props[key]==value),true)
      return (result||val_this_filter)
    },false))
  }
}


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
  let edges = mx_obj.findChildrenRecursive(filter_edges(all_ids))
  return edges
}

const findAllAndEdges=(mx_obj, list_of_filters, edge_origin='target')=>{
  let all_blocks = list_of_filters.map((filter)=>{
    return mx_obj.findChildrenRecursiveObjectFilter(filter)
  }).flat()
  let edges = findEdges(mx_obj,all_blocks,edge_origin)
  return [all_blocks,edges]
}

const findAllEdges=(mx_obj, list_mx_obj, edge_origin='target')=>{
  let all_blocks = list_of_filters.map((filter)=>{
    return mx_obj.findChildrenRecursiveObjectFilter(filter)
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
        let props = val.getProps()
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
const getSimpleBlockFromLibrary = function(library, title){
    return parseStringDrawio(library).then((lib_xml)=>{
        let list_blocks = (lib_xml).mxlibrary
        return Promise.all(JSON.parse(list_blocks).filter((block)=>(block.title==title))
                  .map((obj)=>(parseStringDrawio(decompress(obj.xml)).then((decompressed_block)=>{
                    let obj_val = decompressed_block.mxGraphModel.root[0]['object'][0]
                    //cleaning upper layers
                    let return_obj = {}
                    return_obj['object']=obj_val
                    return new mxObject(return_obj)
        })
        )))
    })
}


/**
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
const modifySimpleBlock = (block, id=null, id_parent=null,new_title=null, x=null, y=null,width=null, height=null, flowio_id=null)=>{
    //let block = JSON.parse(JSON.stringify(block_o))

    if (new_title!=null) block.changeProp('label',new_title)
    if (width!=null) block.changeGeometrySimpleBlock('width',width) //block.object.mxCell[0].mxGeometry[0].$.width = width
    if (height!=null) block.changeGeometrySimpleBlock('height',height)//block.object.mxCell[0].mxGeometry[0].$.height = height
    if (x!=null) block.changeGeometrySimpleBlock('x',x)
    if (y!=null) block.changeGeometrySimpleBlock('y',y)
    if (id!=null) block.changeProp('id',id)
    if (flowio_id!=null) block.changeProp('flowio_id',flowio_id)
    if (id_parent!=null) block.changeParent(id_parent)
    return block
}

/**
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
/**
 * Removes anchor points of edge
 * @param  {Object} {mxcell:[{mxgeometry:[{}]}}
 * @return {Object} x, y, width, height to int
 */
const removeEdgePoints = (edge)=>{
  let new_edge = new mxObject(JSON.parse(JSON.stringify(edge)))
  new_edge.mxCell.mxGeometry[0]={$:new_edge.mxCell.mxGeometry[0].$}
  return new_edge
}
/**
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

/**
 * Reads diagram to fins the id: sync
 * @param  {String} path where the identified diagram resides
 * @return {String} id of the diagram
 */
const getDiagramId = (path)=>{
  let data = fs.readFileSync(path,'utf8')
  let match_regex =(/<diagram id="(?<id>.+?)"/g).exec(data) //.groups.id
  return match_regex.groups.id
}

/**
 * Reads diagram & decompresses: async
 * @param  {String} path where the identified diagram resides
 * @param  {Object} opts opts to parse xml2js 
 * @return {String} id of the diagram
 */
const readDiagram = (path, opts={})=>{
  return fs.promises.readFile(path,'utf8').then((data)=>{
    return parseStringDrawio(data).then((data_value)=>{
      let compressed = data_value['mxfile']['diagram'][0]._;
      return parseStringDrawio(decompress(compressed),opts).then((result_decompressed)=>{
        return  { 'diagram':new mxObject(result_decompressed), 'id':data_value['mxfile']['diagram'][0].$.id }//new mxObject(result_decompressed)
      })
    })
  })
}

/**
 * Groups by a function given
 * @param  {Array} array of blocks
 * @param  {function} func to groupby the blocks
 * @return {Object} grouped the array by the function result 
 */
const groupBy_values = (array, func)=>{
  let groupby_val = _.groupBy(array,func)
  return Object.keys(groupby_val).reduce((final_object, key, index, array)=>{
    let values_key = groupby_val[key].map((obj)=>obj[key])
    final_object[key]=values_key
    return final_object
  },{})
}

/**
 * Gets whole diagram from given mxObjects (id=0 & id=1 at the end of mxCells)
 * @param  {Array[mxObject]} array_obj of blocks
 * @param  {String} root_id the root_id all blocks refer to
 * @return {Object} the big diagram ready to shine 
 */
const getDiagram = (array_obj, root_id)=>{
  if (!Array.isArray(array_obj)) array_obj=[array_obj]
  let real_obj = array_obj.map((item)=>
  {
    return item.getOriginal()
  })
  
  let root = {...groupBy_values(real_obj, Object.keys)}
  if (root['mxCell']==null) root['mxCell']=[]  
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
  getDiagramId:getDiagramId,
  getDiagram:getDiagram,
  //findRelated:findRelated,
  findAllAndEdges:findAllAndEdges,
  clearText:clearText,
  findEdges:findEdges,
  removeEdgePoints:removeEdgePoints,
  readDiagram:readDiagram
}
