/**
 * A Halfedge.
 */
class Halfedge {
  /**
   * Constructor
   * @param {number} i - Index of this halfedge in the Halfedge table
   * @param {number} v - Index of the vertex this halfedge points to 
   * @param {number} f - Index of the face this halfedge bounds (use -1 for a boundary edge)
   * @param {number} next - Index of the next halfedge in the face circulation
   * @param {number} prev - Index of the previous halfedge in the face circulation
   * @param {number} twin - Index of the twin halfedge 
   */
  constructor (i,v,f,next,prev,twin) {
    Object.assign(this,{i,v,f,next,prev,twin})
  }
}

/**
 * A Halfedge data structure.
 */
class HalfedgeDS {
  /**
   * Constructor. Builds an empty data structure.
   */
  constructor () {
    Object.assign(this,{halfedge : [], // Array of all halfedges
                        vertex: [], // Array containing one halfedge per vertex
                        face : [], // Array containing one halfedge per face
                        border: new Set() // set of border faces
                       })
  }
  
  /**
   * Returns a new HalfedgeDS from a list of faces (vertex circulations)
   * @param {array} faceCirculations - array of arrays of indices (each index represents a vertex)
   */
  static fromFaces(faceCirculations) {
    let ds = new HalfedgeDS();
    let {halfedge,vertex,face,border} = ds;
    let edgeLookup = {};
    for (let fc of faceCirculations) {
      let iface = face.length;
      let faceHe = fc.map (ivertex => {
        let ihalfedge = halfedge.length;
        let he = new Halfedge (ihalfedge, ivertex, iface);
        halfedge[ihalfedge] = he;
        if (!vertex[ivertex]) vertex[ivertex] = he; // A Halfedge for this vertex
        return he;
      });
      face.push(faceHe[0]); // A halfedge for this face
      faceHe.forEach((he,i) => { // Link the next and prev indices
        he.prev = faceHe[(i+faceHe.length-1)%faceHe.length].i;
        he.next = faceHe[(i+faceHe.length+1)%faceHe.length].i;
        let vprev = halfedge[he.prev].v;
        let edgeKey = [vprev,he.v];
        if (edgeLookup [edgeKey]) throw Error (`Edge ${edgeKey} defined twice`)
        edgeLookup[edgeKey] = he;
        let twin = edgeLookup[[he.v,vprev]];
        if (twin) { // The twin of this halfedge was seen before: bind them.
          he.twin = twin.i;
          twin.twin = he.i;
        }
      })
    }
    // Close border faces and mark them
    for (let circ of ds._borderCirculations()) {
      border.add(ds._closeBorderCirculation(circ))
    }
    return ds;
  } 
  
  /**
   * Returns an array of halfedge circulations without twins.
   */
  _borderCirculations () {
    let circulations = []
    let vertexLookup = new Map();
    for (let he of this.halfedge) {
      if (he.twin === undefined) vertexLookup.set(he.v,he);
    }
    while (vertexLookup.size > 0) {
      let [v,he] = vertexLookup.entries().next().value;
      let circ = [he];
      circulations.push(circ);
      vertexLookup.delete(v);
      for (;;) {
        let vprev = this.halfedge[he.prev].v;
        if (vertexLookup.has(vprev)) {
          he = vertexLookup.get(vprev);
          circ.push(he);
          vertexLookup.delete(vprev)
        }
        else {
          break;
        }
      }
    }
    return circulations
  }  
  
  /**
   * Closes off a border circulation such as the ones returned by the borderCirculations() method.
   * A new face is then added to the data structure, whose index is returned.
   * Note that calling borderCirculations() again should remove this circulation from the result.
   * @returns the index of the closed face
   **/
  _closeBorderCirculation(circulation) {
    let {halfedge,vertex,face} = this;
    let n = circulation.length;
    let iface = face.length;
    let faceHe = circulation.map ((he,i) => {
      let ihalfedge = halfedge.length;
      let twin = new Halfedge(ihalfedge, circulation[(i+1)%n].v,iface,undefined,undefined,he.i);
      he.twin = ihalfedge;
      halfedge.push(twin)
      return twin
    })
    face.push(faceHe[0]); // A halfedge for this face
    faceHe.forEach((he,i) => { // Link the next and prev indices
      he.prev = faceHe[(i+faceHe.length-1)%faceHe.length].i;
      he.next = faceHe[(i+faceHe.length+1)%faceHe.length].i;
    })
    return iface;
  }
  
  /**
   * Generates all halfedges incident on vertex ivertex
   **/
  *vertexCirculator (ivertex) {
    let he = this.vertex[ivertex], start = he;
    do {
      yield he;
      he = this.halfedge[he.twin];
      he = this.halfedge[he.prev];
    } while (he != start);
  }
  
  /**
   * Generates all halfedges around face iface
   **/
  *faceCirculator (iface) {
    let he = this.face[iface], start = he;
    do {
      yield he;
      he = this.halfedge[he.next]
    } while (he != start);
  }
  
}