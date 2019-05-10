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
  //console.log(values)
  let children = Object.keys(values).filter((key)=>key!='$')//
  if (children==null) return null
  let real_children = []
  children.forEach((nodeType)=>{
    values[nodeType].forEach((real_child)=>{
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
const findChildren = function(root, filter_func){
  if (root==null) return null
  let props = getProps(root)
  if (props!=null){
    if (filter_func==null | filter_func(props)) {
      return [root]
    }
  }
  let children = getChildren(root)

  if (children==null || children.length<1) return null
  let return_value = _.flatMap(children,(child)=>findChildren(child,filter_func)).filter((child)=>child!=null)
  return return_value
}
const findRelated=(xml_obj, id_related, all_related=[], already_seen={})=>{
  /*console.log('id',id_related)
  console.log('all',all_related)
  console.log('seen',already_seen)*/
  if (id_related==null || already_seen[id_related]) return [all_related, already_seen]
  let new_already_seen = {...already_seen}
  let new_all_related = [...all_related]
  let filter_related = (id_to_find)=>{
    return function(props){
      return props.parent==id_to_find || props.target==id_to_find || props.source==id_to_find
    }
  }
  new_already_seen[id_related]=true
  let sons_and_connected = findChildren(xml_obj, filter_related(id_related))
  //console.log(getProps(xml_obj),filter_related(id_related)(gtProps(xml_obj)))
  //console.log(sons_and_connected)
  let id_to_search = sons_and_connected.map((item_dic)=>{
    let item = Object.values(item_dic)[0]
    if(item.$.target==id_related){
      return [item.$.id, item.$.source] //afegim edge i busquem l'altre punta
    }else if(item.$.source==id_related){
      return [item.$.id, item.$.target] //afegim edge i busquem l'altre punta
    }
    return item.$.id //afegim fill i busquem dins
  }).flat()
  let him_list = findChildrenValueFilter(xml_obj, {'id':id_related})//[0]
  //if xml_obj.$.parent
  if (him_list && him_list.length>0){
    new_all_related.push(him_list[0])
    let him = Object.values(him_list[0])[0]
    let parents = findChildrenValueFilter(xml_obj, {'id':him.$.parent})
    if(parents && parents.length>0){
      let parent = Object.values(parents)[0]
      if(Object.keys(parent).includes('flowio_key') && parent.$.id!=null){
        id_to_search.push(parent.$.id)
      }
    }
  }

  let recursive_step = id_to_search.forEach((id_item)=>{
    let result = findRelated(xml_obj, id_item, new_all_related, new_already_seen)
    //console.log('result', result)
    new_all_related = result[0].flat()
    new_already_seen = result[1]
  })
  return [new_all_related, new_already_seen]
}
const findChildrenValueFilter = function(root, obj_filter){
  return findChildren(root, (props)=>_.reduce(obj_filter,(result, value, key) =>
  (result && props[key]==value),true))
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

const formatLabel=(label, new_label)=>{
  if (label == null) return new_label
  let matches = label.match(/\<(.*?)\>/g)
  return matches.slice(0,matches.length/2).join('')+new_label+matches.slice(matches.length/2).join('')
}

//let input = ((await getSimpleBlockFromLibrary(basics, 'input'))[0])
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


//modifySimpleBlock(input[0],'id-input','parent_id', 1,2,4,5)

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
    return drawionode.parseString(data).then((data_value)=>{
      let compressed = data_value['mxfile']['diagram'][0]._;
      return drawionode.parseString(drawionode.decompress(compressed),opts)
    })
  })
}

const getDiagram = (array_obj, root_id)=>{
  return {'mxGraphModel':{'root':[{...groupBy_values(array_obj, Object.keys),'mxCell':[{$: {id: "0"}},{$: {id: root_id, parent: "0"}}]}]}}

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
  findChildren:findChildren,
  findChildrenValueFilter:findChildrenValueFilter,
  getDiagram:getDiagram,
  explicitChildrenToNot:explicitChildrenToNot,
  getGeoSimpleBlock:getGeoSimpleBlock,
  findRelated:findRelated,

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
