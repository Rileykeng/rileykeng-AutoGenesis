const {
	mat3,
	vec3
} = glMatrix;

class Mesh {
	constructor(positions, faces) {
		Object.assign(this, {
			positions,
			faces
		});
		this.computeBox();
		this._faceCenters = this._faceSizes = this._faceNormals = this._vertexNormals =
			this._p5Geometry = this._p5LineGeometry = this._p5FlatGeometry = undefined;
	}

	scale(scaleFactor = 1) {
		for (let pos of this.positions) {
			pos[0] *= scaleFactor;
			pos[1] *= scaleFactor;
			pos[2] *= scaleFactor;
		}
		this.computeBox();
		this._faceCenters = this._faceSizes = this._faceNormals = this._vertexNormals =
			this._p5Geometry = this._p5LineGeometry = this._p5FlatGeometry = undefined;
	}

	normalize(radius = 1) {
		this.scale(radius / this.radius)
	}

	get p5Geometry() {
		return this._p5Geometry || this.computeP5Geometry();
	}

	computeP5Geometry() {
		let {
			positions,
			faceNormals,
			vertexNormals
		} = this;
		let trifaces = [...this.triangleFaces()];
		let geom = new p5.Geometry(1, 1, function() {
			this.vertices = positions.map(p => createVector(...p));
			this.faces = trifaces;
			this.vertexNormals = vertexNormals.map(p => createVector(...p));
			this.gid = `${random()}`;
		})
		this._p5Geometry = geom;
		return geom;
	}

	get p5LineGeometry() {
		return this._p5LineGeometry || this.computeP5LineGeometry();
	}
	
	computeP5LineGeometry() {
		beginGeometry();
		for (let [i, j] of this.edges) {
			line (...this.positions[i], ...this.positions[j])
		}
		let geom = endGeometry();
		this._p5LineGeometry = geom;
		return geom;
	}

	get p5FlatGeometry() {
		return this._p5FlatGeometry || this.computeP5FlatGeometry();
	}
	
	computeP5FlatGeometry() {
		let {
			positions,
			faces,
			faceNormals,
		} = this;
		
		let geom = new p5.Geometry(1, 1, function() {
			let trifaces = [];
			let vertices = [];
			let vnormals = [];
			for (let iface = 0; iface < faces.length; iface++) {
				let f = faces[iface];
				let fn = createVector(...faceNormals[iface]);
				for (let i = 2; i < f.length; i++) {
					let triface = [];
					for (let iv of [f[0], f[i - 1], f[i]]) {
						let k = vertices.length;
						vertices.push(createVector(...positions[iv]));
						triface.push (k,k+1,k+2);
						vnormals.push(fn)
					}
				}
			}
			
			this.vertices = vertices;
			this.faces = trifaces;
			this.vertexNormals = vnormals;
			this.gid = `${random()}`;
		})
		this._p5FlatGeometry = geom;
		return geom;
	}
	
	freeGeometries () {
		for (let geom of ["_p5Geometry", "_p5FlatGeometry", "_p5LineGeometry"]) {
			if (this[geom]) freeGeometry(this[geom]);
			this[geom] = null
		}
	}

	// Converts to wavefront obj format
	obj() {
		let {
			positions,
			faces
		} = this;
		return positions
			.map((pos) => `v ${pos.join(" ")}`)
			.concat(faces.map((face) => `f ${face.map((v) => v + 1).join(" ")}`))
			.join("\n");
	}

	// Generates triangular faces for non-triangle meshes
	* triangleFaces() {
		for (let f of this.faces) {
			if (f.length == 3) yield f;
			else {
				for (let i = 2; i < f.length; i++) {
					yield [f[0], f[i - 1], f[i]];
				}
			}
		}
	}

	get edges() {
		return this._edges || this.computeEdges();
	}

	computeEdges() {
		let {
			faces
		} = this;
		let edges = [];
		for (let cell of faces) {
			let i = cell[cell.length - 1];
			for (let j of cell) {
				if (i < j) edges.push([i, j]);
				i = j;
			}
		}
		this._edges = edges;
		return edges;
	}

	get faceNormals() {
		return this._faceNormals || this.computeFaceCentersNormalsAndSizes().normals;
	}

	get faceCenters() {
		return this._faceCenters || this.computeFaceCentersNormalsAndSizes().centers;
	}

	get faceSizes() {
		return this._faceSizes || this.computeFaceCentersNormalsAndSizes().sizes;
	}

	computeFaceCentersNormalsAndSizes() {
		let {
			positions,
			faces
		} = this;
		let normals = [];
		let centers = [];
		let sizes = [];
		for (let cell of faces) {
			let vtx = cell.map((i) => positions[i]);
			let [a, b, c, ...rest] = vtx;
			let u = vec3.sub([], b, a);
			let v = vec3.sub([], c, b);
			normals.push(vec3.normalize([], vec3.cross([], u, v)));
			let center = [0, 0, 0];
			let size = 0;
			for (let p of vtx) {
				vec3.add(center, center, p);
				size += vec3.dist(center, p)
			}
			vec3.scale(center, center, 1 / vtx.length);
			size /= vtx.length;
			centers.push(center);
			sizes.push(size);
		}
		this._faceNormals = normals;
		this._faceCenters = centers;
		this._faceSizes = sizes;
		return {
			normals,
			centers,
			sizes
		};
	}

	get vertexNormals() {
		return this._vertexNormals || this.computeVertexNormals();
	}

	computeVertexNormals() {
		let {
			positions,
			faces
		} = this;
		let faceNormals = this.faceNormals;
		let normal = [];
		let iface = 0;
		for (let face of faces) {
			for (let ivertex of face) {
				if (normal[ivertex]) {
					vec3.add(normal[ivertex], normal[ivertex], faceNormals[iface]);
				} else {
					normal[ivertex] = [...faceNormals[iface]];
				}
			}
			iface++;
		}
		for (let i = 0; i < normal.length; i++)
			normal[i] = vec3.normalize([], normal[i]);
		this._vertexNormals = normal;
		return normal;
	}

	computeBox() {
		let vtx = this.positions;
		let min = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
		let max = [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];
		for (let p of vtx) {
			for (let i of [0, 1, 2]) {
				min[i] = Math.min(min[i], p[i]);
				max[i] = Math.max(max[i], p[i]);
			}
		}
		let center = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
		let size = [0, 1, 2]
			.map((i) => max[i] - min[i])
			.reduce((a, b) => Math.max(a, b));
		let radius = vec3.dist(center, max);
		Object.assign(this, {
			center,
			size,
			radius,
			min,
			max
		});
	}
}