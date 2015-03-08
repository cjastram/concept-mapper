
var _WORKSPACE = null
var _OBJECTS = {}
var _CONNECTIONS = {} 
var _LINE = null
var _SELECTED = []
var _ID = 1
var _TIMEOUT = null
var _STYLES = {
    Topic: {
        fill: "#eef",
        stroke: "#333",
        paddingx: 14,
        paddingy: 5,
    },
    Transition: {
        fill: "#fff",
        stroke: "#fff",
        paddingx: 4,
        paddingy: 1,
    },
}

function id() { return _ID++ }

function saveTimeout() {
    if (_TIMEOUT) {
        clearTimeout(_TIMEOUT)
    }
    //_TIMEOUT = setTimeout(save, 1000)
}
function save() {
    var save = []
    for (i in _OBJECTS)
        save.push(_OBJECTS[i].save())
    for (i in _CONNECTIONS)
        save.push(_CONNECTIONS[i].save())
        
    $('#data').val(JSON.stringify(save))
}
function btn_load() {
    var e = $("#data")
    var parsed = JSON.parse(e.val())
    _OBJECTS = {}
    _CONNECTIONS = {}
    for (i in parsed) {
        var object = new window[parsed[i]["type"]]()
        object.load(parsed[i])
        if (parsed["type"] == "Line") {
            _CONNECTIONS[object["id"]] = object
        } else {
            _OBJECTS[object["id"]] = object
        }
    }
    for (i in _OBJECTS) {
        _OBJECTS[i].refresh()
    }
}

function select(object, e) {
    found = false
    if (_SELECTED.length) {
        for (i in _SELECTED) {
            //if (_SELECTED[i] == object) {
                //found = true
            //} else {
                _SELECTED[i].deselect()
            //}
        }
    }
    if (object != null && ! found) {
        object.select()
    }
}


function Widget(args){
    this.selected = false
    this.id = id()

    for( key in args ) { 
    if( ! (key in this) ) {
      console.log("Parameter '" + key +"' not defined in object type: " + this.constructor.name);
    }
    // This can vary quite a bit, see each individual widget for acceptable parameters
    this[key] = args[key]; 
  }
}
Widget.prototype = {
    select : function(e){
        _SELECTED.push(this)
        this.selected = true
    },
    deselect : function(e){
        for (i=_SELECTED.length-1; i>=0; i--)
        {
            if (_SELECTED[i].id == this.id) {
                _SELECTED.splice(i, 1)
            }
        }
        this.selected = false
    },
    load : { value: function(data) {
        for (i in data) {
            this[i] = data[i]
        }
    }},
    save : function(e){
        return {"type": this.constructor.name, "id": this.id}
    },
}

function Topic(a, b){
    this.x = 10
    this.y = 10
    this.width = 50
    this.height = 30
    this.text = '???'
    Widget.call(this, a)

    this._l = this.x - Math.floor(this.width/2)
    this._t = this.y - Math.floor(this.height/2)

    var object = this
    this._box = _WORKSPACE.rect(this._l, this._t, this.width, this.height, 5).attr({
        fill: _STYLES[this.constructor.name]["fill"],
        stroke: _STYLES[this.constructor.name]["stroke"],
    })
    this._bbox = null // bounding box
    this._dbox = null // drag box
    this._text = null // just what it says
    
    this._box.click(function (e) { select(object, e) })
    this._box.dblclick(function (e) { 
        object.text = prompt('Enter text for object:', object.text)
        object.refresh()
    })

    this._box.drag(function(dx, dy, x, y, e) { // Move
        object.x += e.movementX
        object.y += e.movementY 
        object.refresh()
    }, function(dx, dy, x, y, e) { // Start
        select(object, e)
    }, function() { // Up
        object.refresh()
    })
    object.refresh()
}
Topic.prototype = Object.create(Widget.prototype, {
    refresh : { value: function() {
        handle = this

        if (this._text == null)  {
            this._text = _WORKSPACE.text(this.x, this.y, this.text)
            this._text.attr({'font-size': 11})
        } else {
            this._text.attr({x: this.x, y: this.y, text: this.text})
        }
        var bbox = this._text.getBBox()
        this.width = bbox.width+_STYLES[this.constructor.name]["paddingx"],
        this.height = bbox.height+_STYLES[this.constructor.name]["paddingy"],
    
        this._l = this.x - Math.floor(this.width/2)
        this._t = this.y - Math.floor(this.height/2)

        this._box.attr({ x: this._l, y: this._t, width: this.width, height: this.height })
        if (this._bbox != null)
            this._bbox.attr({x: this._l-2, y: this._t-2, width: this.width+4, height: this.height+4})
        if (this._dbox != null)
            this._dbox.attr({ x: this._l+2, y: this._t-10 })

        if (this.selected) {
            // Adjust the bounding box when the topic moves or is resized
            if (this._bbox == null) {
                this._bbox = _WORKSPACE.rect(this._l-2, this._t-2, this.width+4, this.height+4)
                    .attr({fill: "#319cff", stroke: "#319cff"})
                    .insertBefore(this._box)
            }

            // Adjust drag handle, also handle connection creation
            if (this._dbox == null) {
                this._dbox = _WORKSPACE.rect(this._l+2, this._t-10, 10, 10)
                    .attr({fill: "#319cff", stroke: "#319cff"})
                    .insertBefore(this._box)
                this._dbox.drag(function(dx, dy, x, y, e) { // Move
                    if (_LINE != null) {
                        var x = e.x
                        var y = e.y
                        //var x = e.offsetX
                        //var y = e.offsetY
                        //console.log(e)
                        //console.log(x)
                        //console.log(y)
                        _LINE.obj2 = null
                        for (i in _OBJECTS) {
                            var o = _OBJECTS[i]
                            if (o != handle) {
                                if (o.where(x, y)) {
                                    _LINE.obj2 = o.id
                                }
                            }
                        }
                        _LINE.x2 = x
                        _LINE.y2 = y
                        _LINE.refresh()
                    }
                }, function(x, y, e) { // Start
                    _LINE = new Line({obj1: handle.id, x2: e.offsetX, y2: e.offsetY})
                    _CONNECTIONS[_LINE.id] = _LINE
                }, function() { // Up
                    // Create a new topic if the line is dropped somewhere new
                    var line = _LINE
                    if (line.obj2 == null) {
                        var topic = new Topic({x: line.x2, y: line.y2})
                        _OBJECTS[topic.id] = topic
                        line.obj2 = topic.id
                    }
                    // If both endpoints of line are a topic, add a transition
                    o1 = line.obj1 ? _OBJECTS[line.obj1].constructor.name : null
                    o2 = line.obj2 ? _OBJECTS[line.obj2].constructor.name : null
                    if (o1 == "Topic" && o2 == "Topic")
                    {
                        var x = Math.floor((line.x1+line.x2)/2)
                        var y = Math.floor((line.y1+line.y2)/2)
                        var transition = new Transition({x: x, y: y})
                        _OBJECTS[transition.id] = transition
                        var line2 = new Line({obj1: transition.id, obj2: line.obj2})
                        _CONNECTIONS[line2.id] = line2
                        line.obj2 = transition.id
                    }
                    if (o1 == "Transition" && o2 == "Transition") {
                        _LINE.remove()
                    }
                    _LINE = null
                })
            }
        } else {
            if (this._bbox != null) {
                this._bbox.remove()
                this._bbox = null
            }
            if (this._dbox != null) {
                this._dbox.remove()
                this._dbox = null
            }
        }

        // Adjust connectors
        for (i in _CONNECTIONS)
            if (_CONNECTIONS[i].obj1 == this.id || _CONNECTIONS[i].obj2 == this.id)
                _CONNECTIONS[i].refresh()
        saveTimeout()
    }},
    select : { value: function() {
        Widget.prototype.select.apply(this, arguments)
        this.refresh()
    }},
    deselect : { value: function() {
        Widget.prototype.deselect.apply(this, arguments)
        this.refresh()
    }},
    load : { value: function(data) {
        for (i in data) {
            this[i] = data[i]
        }
    }},
    save : { value: function(x, y) {
        serialized = Widget.prototype.save.apply(this, arguments)
        for (i in this) {
            if (['string', 'number'].indexOf(typeof this[i]) >= 0) {
                serialized[i] = this[i]
            }
        }
        return serialized
    }},
    
    // Utility function to determine whether a point lies inside the box or not.
    // Returns false if not inside, else most plausible attachment point.
    where : { value: function(x, y) {
        var l = this._l
        var r = l + this.width
        var t = this._t
        var b = t + this.height
        if (x > l && x < r && y > t && y < b) {
            return "center"
        }
        return false
    }},

});
Topic.prototype.constructor = Topic;


function Transition(a, b){
    Topic.call(this, a)
}
Transition.prototype = Object.create(Topic.prototype, {
    load : { value: function(data) {
        for (i in data) {
            this[i] = data[i]
        }
    }},
});
Transition.prototype.constructor = Transition;


function Line(a, b){
    this.obj1 = null
    this.obj2 = null
    this.x1 = 10
    this.y1 = 20
    this.x2 = 30
    this.y2 = 40
    this._path = null
    Widget.call(this, a)
  
    var object = this
    this._line = _WORKSPACE.path(["M", this.x1, this.y1, "L", this.x2, this.y2 ])
    this.refresh()
}
Line.prototype = Object.create(Widget.prototype, {
    refresh : { value: function() {
        if (this.obj1 != null) {
            var obj = _OBJECTS[this.obj1]
            this.x1 = obj.x
            this.y1 = obj.y
        }
        if (this.obj2 != null) {
            var obj = _OBJECTS[this.obj2]
            this.x2 = obj.x
            this.y2 = obj.y
        }
        this._line.attr({path: ["M", this.x1, this.y1, "L", this.x2, this.y2 ]})
        this._line.toBack()
        saveTimeout()
    }},
    /*
    select : { value: function() {
        Widget.prototype.select.apply(this, arguments)
        this.refresh()
    }},
    deselect : { value: function() {
        Widget.prototype.deselect.apply(this, arguments)
        this.refresh()
    }},
    */
    load : { value: function(data) {
        for (i in data) {
            this[i] = data[i]
        }
    }},
    save : { value: function(x, y) {
        serialized = Widget.prototype.save.apply(this, arguments)
        for (i in this) {
            if (['string', 'number'].indexOf(typeof this[i]) >= 0) {
                serialized[i] = this[i]
            }
        }
        return serialized
    }},

    remove : { value: function() {
        this._line.remove()
        delete _CONNECTIONS[this.id]
        //Widget.prototype.remove.apply(this, arguments)
    }},

});
Line.prototype.constructor = Line;


_SELECTED_AT_LAST_EDIT = null

function refreshPage() {
    $('#canvas_container').width(window.innerWidth)
    $('#canvas_container').height(window.innerHeight)
    _WORKSPACE.setSize(window.innerWidth, window.innerHeight)
}

$(document).ready(function() {
    _WORKSPACE = new Raphael(document.getElementById('canvas_container'), 500, 500);
    
    $('#canvas_container').bind('dblclick', function(e) {
        if (e.target.nodeName == "svg")
        {
            var x = e.offsetX
            var y = e.offsetY
            var topic = new Topic({"x": x, "y": y})
            select(topic, e)
            _OBJECTS[topic.id] = topic
        }
    })
    
    $('#canvas_container').bind('click', function(e) {
        if (e.target.nodeName == "svg")
        {
            select(null, e)
        }
    })

    $(window).resize(function(e) {
        refreshPage()
    })
    refreshPage()
})

document.onkeypress = function(e)
{
    if (_SELECTED.length != 1) return

    var charCode = e.which || e.keyCode
    var charStr = String.fromCharCode(charCode);
    var object = _SELECTED[0]
    if (object.id != _SELECTED_AT_LAST_EDIT) {
        object.text = ""
        _SELECTED_AT_LAST_EDIT = object.id
    }
    object.text += charStr
    if (e.keyCode === 32) { // space
        // Don't page downwards on <space> press
        e.preventDefault()
    }

    object.refresh()
}

document.onkeydown = function(e)
{
    if (_SELECTED.length != 1) return

    var charCode = e.which || e.keyCode
    var charStr = String.fromCharCode(charCode);
    var object = _SELECTED[0]
    if (e.keyCode === 8) { // backspace
        if (object.text.length > 0) {
            object.text = object.text.substring(0, object.text.length-1)
        }
        // Don't backspace out of the page!
        e.stopPropagation()
        e.preventDefault()
    }
    object.refresh()
}
