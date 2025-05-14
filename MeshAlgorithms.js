// Computes the dual of a mesh
// @mesh - an object containing positions, array of points, each a 3-coordinate array, and
//          faces, an array of face circulations, each an array with n indices of positions
const dual = (mesh) => {
	let {
		positions,
		faces
	} = mesh;
	let ds = HalfedgeDS.fromFaces(faces);

	// Function to sum an array of points
	let sum = pts => pts.reduce((p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]]);

	// Function to average an array of points
	let avg = pts => sum(pts).map(x => x / pts.length);

	// Build face midpoints
	let faceMidPoints = ds.face.map(
		(he, iface) => avg([...ds.faceCirculator(iface)].map(he => positions[he.v]))
	);

	// Compute new faces
	let newPositions = faceMidPoints,
		newFaces = [];

	// Vertex faces (one for each original vertex)
	ds.vertex.forEach(
		(he, i) => {
			let newFace = [];
			for (let vtxHe of ds.vertexCirculator(i)) {
				newFace.push(vtxHe.f);
			}
			newFaces.push(newFace)
		});

	return new Mesh(newPositions, newFaces);
}


// @returns the Doo-Sabin subdivision of an input mesh
// @mesh - an object containing positions, array of points, each a 3-coordinate array, and
//          faces, an array of face circulations, each an array with n indices of positions
// @param bias - biases the weighting for the new vertices: 0 yields the normal doo-sabin weights,
//               a positive value yields smaller vertex and edge faces, while a negative value
//               yields larger vertex and edge faces.
const dooSabin = (mesh, bias = 0) => {

	let {
		positions,
		faces
	} = mesh;
	let ds = HalfedgeDS.fromFaces(faces);

	// Function to sum an array of points
	const sum = pts => pts.reduce((p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]]);

	// Function to average an array of points
	const avg = pts => sum(pts).map(x => x / pts.length);

	// Build face midpoints
	let faceMidPoints = ds.face.map(
		(he, iface) => avg([...ds.faceCirculator(iface)].map(he => positions[he.v]))
	);

	// Function to map an edge (a halfedge and its twin) to the edge midpoint
	let edgeToMidpoint = (he, twin) => vec3.lerp([], positions[he.v], positions[twin.v], 0.5);

	// Compute all edge midpoints
	ds.halfedge.forEach(
		he => {
			let twin = ds.halfedge[he.twin]
			if (he.v < twin.v) { // Process each edge only once
				let midPoint = edgeToMidpoint(he, twin)
				he.midPoint = twin.midPoint = midPoint
			}
		});


	// Compute new faces
	let newPositions = [],
		newFaces = [];

	// The face point averaging function
	let facePointFunc = bias == 0 ? (fp, vp, e1, e2) => avg([fp, vp, e1, e2]) :
		bias < 0 ? (fp, vp, e1, e2) => vec3.lerp([],
			vec3.lerp([], vp, fp, 0.5 - bias),
			vec3.lerp([], e1, e2, 0.5),
			0.5 + bias) :
		(fp, vp, e1, e2) => vec3.lerp([],
			vec3.lerp([], fp, vp, 0.5 + bias),
			vec3.lerp([], e1, e2, 0.5),
			0.5 - bias);
	// Shrunk faces (one for each original face)
	ds.face.forEach((heface, iface) => {
		let newFace = [];
		for (let he of ds.faceCirculator(iface)) {
			let iNewFacePoint = newPositions.length;
			newFace.push(iNewFacePoint);
			let facePoint = faceMidPoints[iface];
			let edgeMidPoint1 = he.midPoint;
			let vertexPoint = positions[he.v];
			let edgeMidPoint2 = ds.halfedge[he.next].midPoint;
			let newFacePoint = facePointFunc(facePoint, vertexPoint, edgeMidPoint1, edgeMidPoint2);
			he.iFacePoint = iNewFacePoint;
			newPositions.push(newFacePoint);
		}
		newFaces.push(newFace)
	})

	// Edge faces (one for each original edge)
	ds.halfedge.forEach(
		he => {
			let twin = ds.halfedge[he.twin]
			if (he.v < twin.v) { // Process each edge only once
				let hePrev = ds.halfedge[he.prev];
				let twinPrev = ds.halfedge[twin.prev];
				newFaces.push([
					he.iFacePoint,
					hePrev.iFacePoint,

					twin.iFacePoint,
					twinPrev.iFacePoint
				]);
			}
		});

	// Vertex faces (one for each original vertex)
	ds.vertex.forEach(
		(he, i) => {
			let newFace = [];
			for (let vtxHe of ds.vertexCirculator(i)) {
				newFace.push(vtxHe.iFacePoint);
			}
			newFaces.push(newFace)
		});

	return new Mesh(newPositions, newFaces);
}

// @returns the subdivision of an input mesh
// @mesh - an object containing positions, array of points, each a 3-coordinate array, and
//          faces, an array of face circulations, each an array with n indices of positions
// @param catmull - if true, perform catmull-clarks subdivision, otherwise, regular (flat) subdivision
// @param repeat - how many iterations to perform
const subdivide = (mesh, catmull = false) => {
	let {
		positions,
		faces
	} = mesh;

	let ds = HalfedgeDS.fromFaces(faces);

	// Function to sum an array of points
	let sum = pts => pts.reduce((p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]]);

	// Function to average an array of points
	let avg = pts => sum(pts).map(x => x / pts.length);

	// Multiplies all elements of v by s
	let scale = (v, s) => v.map(x => x * s);

	// Build face midpoints
	let facePoints = ds.face.map(
		(he, iface) => avg([...ds.faceCirculator(iface)].map(he => positions[he.v]))
	);

	// Function to map an edge (a halfedge and its twin) to the edge midpoint
	let edgeToMidpoint = (he, twin) => avg([positions[he.v], positions[twin.v]]);

	// Function to map an edge to its catmull-clark new position, which takes
	// into account the neighboring center points of neighbor points
	let edgeToSubdivisionPoint =
		(he, twin) => sum([scale(positions[he.v], 0.25),
			scale(positions[twin.v], 0.25),
			scale(facePoints[he.f], 0.25),
			scale(facePoints[twin.f], 0.25)
		]);

	// Compute all edge points
	let edgePoints = [];
	let edgeMidPoints = []
	ds.halfedge.forEach(
		he => {
			let twin = ds.halfedge[he.twin]
			if (he.v < twin.v) { // Process each edge only once
				he.iEdgePoint = twin.iEdgePoint = edgePoints.length;
				let midpoint = edgeToMidpoint(he, twin)
				edgeMidPoints.push(midpoint)
				if (catmull) edgePoints.push(edgeToSubdivisionPoint(he, twin));
				else edgePoints.push(midpoint)
			}
		});

	// Compute the new position of vertex v in a Catmull-Clark subdivision
	let newPosition = ivertex => {
		let incidentHalfedges = [...ds.vertexCirculator(ivertex)];
		let incidentFacePoints = incidentHalfedges.map(he => facePoints[he.f]);
		let incidentEdgePoints = incidentHalfedges.map(he => edgeMidPoints[he.iEdgePoint]);
		let n = incidentHalfedges.length;
		return sum([scale(positions[ivertex], (n - 3) / n),
			scale(avg(incidentFacePoints), 1 / n),
			scale(avg(incidentEdgePoints), 2 / n)
		])
	}

	// Array with the new positions of the original vertices
	let newPositions = (catmull ? positions.map((d, i) => newPosition(i)) : positions);

	// Compute the new face circulations
	let n = positions.length;
	let m = edgePoints.length;
	newPositions = newPositions.concat(edgePoints).concat(facePoints);
	let newFaces = [];
	ds.face.forEach((he, i) => {
		let edgeIndices = []
		for (let he of ds.faceCirculator(i)) edgeIndices.push(he.iEdgePoint + n, he.v, );
		let ne = edgeIndices.length;
		for (let k = 0; k < edgeIndices.length; k += 2) {
			newFaces.push([i + n + m, edgeIndices[k], edgeIndices[(k + 1) % ne], edgeIndices[(k + 2) % ne]]);
		}
	})
	positions = newPositions;
	faces = newFaces;
	return new Mesh(positions, faces)
}

// @returns the 'cut corner' subdivision of an input mesh
// @mesh - an object containing positions, array of points, each a 3-coordinate array, and
//          faces, an array of face circulations, each an array with n indices of positions
// @param amount - how far from each edge endpoint is the cut made
const cutCorners = (mesh, amount = 0.5) => {
	let {
		positions,
		faces
	} = mesh;
	let ds = HalfedgeDS.fromFaces(faces);

	// Function to sum an array of points
	let sum = pts => pts.reduce((p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]]);

	// Function to average an array of points
	let avg = pts => sum(pts).map(x => x / pts.length);

	// Multiplies all elements of v by s
	let scale = (v, s) => v.map(x => x * s);

	// Build face midpoints
	let faceMidPoints = ds.face.map(
		(he, iface) => avg([...ds.faceCirculator(iface)].map(he => positions[he.v]))
	);

	// Function to map an edge (a halfedge and its twin) to the edge midpoint
	let edgeToMidpoint = (he, twin) => avg([positions[he.v], positions[twin.v]]);

	// Compute all edge cut corners
	let newPositions = [];
	ds.halfedge.forEach(
		he => {
			let twin = ds.halfedge[he.twin]
			if (he.v < twin.v) { // Process each edge only once
				let [a, b] = [positions[he.v], positions[twin.v]]
				//let midPoint = avg([positions[he.v],positions[twin.v]]);
				let i = newPositions.length;
				// newPositions.push (avg([positions[he.v],midPoint]),
				//                    avg([positions[twin.v],midPoint]));
				if (amount >= 0.5) {
					newPositions.push(vec3.lerp([], a, b, 0.5));
					he.cut1 = twin.cut2 = he.cut2 = twin.cut1 = i;
				} else {
					newPositions.push(vec3.lerp([], a, b, amount),
						vec3.lerp([], b, a, amount));
					he.cut1 = twin.cut2 = i;
					he.cut2 = twin.cut1 = i + 1;
				}
			}
		});


	// Compute new faces
	let newFaces = [];

	// Shrunk faces (one for each original face)
	ds.face.forEach((heface, iface) => {
		let newFace = [];
		for (let he of ds.faceCirculator(iface)) {
			newFace.push(he.cut2);
			if (amount < 0.5) newFace.push(he.cut1);
		}
		newFaces.push(newFace)
	})

	//return {positions:newPositions, cells:newFaces};


	// Vertex faces (one for each original vertex)
	ds.vertex.forEach(
		(he, i) => {
			let newFace = [];
			for (let vtxHe of ds.vertexCirculator(i)) {
				newFace.push(vtxHe.cut1);
			}
			newFaces.push(newFace)
		});

	return new Mesh(newPositions, newFaces);
}


// Given two extreme values minRadius and maxRadius, returns a function f(r) that
// exagerates values of r far from the middle, for bias != 0. If bias < 0, the exageration
// reverses the distance from the middle, i.e., values close to minRadius will be put close to maxRadius and
// vice versa.
const radiusBias = (minRadius, maxRadius, bias = 1) => {
	let dr = maxRadius - minRadius;
	if (dr < 0.00001) return r => r;
	else {
		if (bias >= 0) return r => {
			let t = (r - minRadius) / dr;
			let t2 = t > 0.5 ? (t - 0.5 + 1) ** (1 + bias) - 1 + 0.5 : 0.5 - ((0.5 - t + 1) ** (1 + bias) - 1);
			return minRadius + t2 * dr;
		}
		else {
			bias = -bias;
			return r => {
				let t = 1 - (r - minRadius) / dr;
				let t2 = t > 0.5 ? (t - 0.5 + 1) ** (1 + bias) - 1 + 0.5 : 0.5 - ((0.5 - t + 1) ** (1 + bias) - 1);
				return minRadius + t2 * dr;
			}
		}
	}
}

// @returns the 'extrude center' subdivision of an input mesh
// @mesh - an object containing positions, array of points, each a 3-coordinate array, and
//          faces, an array of face circulations, each an array with n indices of positions
// @param amount - ratio with respect to the average radius of the face used to displace face centers 
//                 in the direction of the face normals
const extrudeCenters = (mesh, amount = 1 / Math.sqrt(2), bias = 1) => {
	let {
		positions,
		faces
	} = mesh;
	let ds = HalfedgeDS.fromFaces(faces);

	// Function to sum an array of points
	let sum = pts => pts.reduce((p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]]);

	// Function to average an array of points
	let avg = pts => sum(pts).map(x => x / pts.length);

	// Multiplies all elements of v by s
	let scale = (v, s) => v.map(x => x * s);

	// Build face midpoints and face normals
	let newPositions = positions.slice(0);
	let normals = [],
		centers = [];
	let radii = [],
		minRadius = Number.MAX_VALUE,
		maxRadius = Number.MIN_VALUE;
	let faceMid = [];
	ds.face.forEach(
		(he, iface) => {
			let nvtx = 0;
			let distSum = 0;
			let faceMidPoint = avg([...ds.faceCirculator(iface)].map(he => positions[he.v]));
			for (let vtxhe of ds.faceCirculator(iface)) {
				let p = positions[vtxhe.v];
				nvtx++;
				distSum += vec3.dist(p, faceMidPoint)
			}
			let radius = distSum / nvtx;
			minRadius = Math.min(minRadius, radius);
			maxRadius = Math.max(maxRadius, radius);
			radii.push(radius)
			let a = positions[he.v];
			let b = positions[ds.halfedge[he.next].v];
			let normal = (vec3.normalize([], vec3.cross([], vec3.sub([], a, b), vec3.sub([], b, faceMidPoint))));
			normals.push(normal);
			centers.push(faceMidPoint)
		}
	);

	let biasFunc = radiusBias(minRadius, maxRadius, bias);
	ds.face.forEach(
		(he, iface) => {
			faceMid[iface] = newPositions.length;
			newPositions.push(vec3.add([], centers[iface], vec3.scale([], normals[iface],
				biasFunc(radii[iface]) * amount)))
		}
	);


	// Compute new faces
	let newFaces = [];

	// Face "umbrellas": a triangle fan for each original face
	ds.face.forEach((heface, iface) => {
		let mid = faceMid[iface];
		for (let he of ds.faceCirculator(iface)) {
			let twin = ds.halfedge[he.twin]
			newFaces.push([mid, twin.v, he.v]);
		}
	})

	return new Mesh(newPositions, newFaces);

}

// @returns the 'extrude Face' subdivision of an input mesh
// @mesh - an object containing positions, array of points, each a 3-coordinate array, and
//          faces, an array of face circulations, each an array with n indices of positions
// @param shift - ratio with respect to the average radius of the face. Used to displace faces 
//                 in the direction of the face normals
// @param scale - relative size of the extruded face with respect to the original face
const extrudeFaces = function(mesh, shift = 1 / Math.sqrt(2), scale = 0.5, bias = 0) {
	let {
		positions,
		faces
	} = mesh;
	let ds = HalfedgeDS.fromFaces(faces);

	// Function to sum an array of points
	let sum = pts => pts.reduce((p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]]);

	// Function to average an array of points
	let avg = pts => sum(pts).map(x => x / pts.length);

	// Build face midpoints and face normals
	let newPositions = positions.slice(0);
	let midPoints = [];
	let normals = [];
	let radii = [],
		minRadius = Number.MAX_VALUE,
		maxRadius = Number.MIN_VALUE;
	ds.face.forEach(
		(he, iface) => {
			let nvtx = 0;
			let distSum = 0;
			let faceMidPoint = avg([...ds.faceCirculator(iface)].map(he => positions[he.v]));
			midPoints.push(faceMidPoint);
			for (let vtxhe of ds.faceCirculator(iface)) {
				let p = positions[vtxhe.v];
				nvtx++;
				distSum += vec3.dist(p, faceMidPoint)
			}
			let radius = distSum / nvtx;
			radii.push(radius);
			minRadius = Math.min(minRadius, radius);
			maxRadius = Math.max(maxRadius, radius);
			let a = positions[he.v];
			let b = positions[ds.halfedge[he.next].v];
			let normal = (vec3.normalize([], vec3.cross([], vec3.sub([], a, b), vec3.sub([], b, faceMidPoint))));
			normals.push(normal);
		}
	);


	// Compute new faces
	let newFaces = [];

	let biasFunc = radiusBias(minRadius, maxRadius, bias);

	// Face "plateaux": a new face for each original face connected to the original edges by rectangular faces
	ds.face.forEach((heface, iface) => {
		let normal = normals[iface];
		vec3.scale(normal, normal, biasFunc(radii[iface]) * shift)
		let mid = midPoints[iface];
		let newFace = [];
		let n = 0;
		// The plateau face
		for (let he of ds.faceCirculator(iface)) {
			let p = positions[he.v];
			let u = vec3.sub([], p, mid);
			u = vec3.scale([], u, scale);
			p = vec3.add([], mid, u);
			let newVertex = vec3.add([], p, normal);
			newFace.push(newPositions.length);
			newPositions.push(newVertex);
			n++
		}
		newFaces.push(newFace);
		// The connecting rectangles
		let i = 0;
		for (let he of ds.faceCirculator(iface)) {
			newFaces.push([he.v, newFace[i], newFace[(i + n - 1) % n], ds.halfedge[he.prev].v])
			i++;
		}
	})

	return new Mesh(newPositions, newFaces);
}

function extendedCatmull(
  mesh,
  wf = 0,
  we = 0,
  wp = 0,
  w1 = 0,
  w2 = 0,
  w3 = 0,
  w4 = 0
) {
  let { positions, faces, faceNormals, vertexNormals, faceCenters, faceSizes } =
    mesh;
  let ds = HalfedgeDS.fromFaces(faces);

  // Build face points, but first check if we are using eq (4) from Hansmeyers paper or eq(1).
  // Eq 4 requires all faces to be quads already and is worth computing only if w3 or w4 are not 0
  const fancyMidPoints =
    (w3 != 0 || w4 != 0) &&
    faces.length != 6 &&
    faces.map((f) => f.length == 4).reduce((a, b) => a && b);

  let newPositions = fancyMidPoints
    ? faces.map((face, iface) => {
        let [F, E1, V, E2] = face.map((i) => positions[i]);
        let fvterm = vec3.add(
          [],
          vec3.scale([], V, 1 + w3),
          vec3.scale([], F, 1 - w3)
        );
        let eterm = vec3.add([], E1, E2);
        let center = vec3.scale(
          [],
          vec3.add(
            [],
            vec3.scale([], fvterm, 1 + w4),
            vec3.scale([], eterm, 1 - w4)
          ),
          0.25
        );
        return vec3.add(
          [],
          center,
          vec3.scale([], faceNormals[iface], wf * faceSizes[iface])
        );
      })
    : faceCenters.map((center, iface) =>
        vec3.add(
          [],
          center,
          vec3.scale([], faceNormals[iface], wf * faceSizes[iface])
        )
      );

  //let nFacePoints = newPositions.length;

  // Build edge points
  ds.halfedge.forEach((he) => {
    let twin = ds.halfedge[he.twin];
    if (he.v < twin.v) {
      // Process each edge only once
      he.iEdgePoint = twin.iEdgePoint = newPositions.length;
      let f1 = newPositions[he.f];
      let f2 = newPositions[twin.f];
      let p1 = positions[he.v];
      let p2 = positions[twin.v];
      let ne = vec3.normalize(
        [],
        vec3.add([], faceNormals[he.f], faceNormals[twin.f])
      );
      let edgePoint = vec3.add(
        [],
        vec3.scale(
          [],
          vec3.add(
            [],
            vec3.scale([], vec3.add([], f1, f2), 1 + w1),
            vec3.scale([], vec3.add([], p1, p2), 1 - w1)
          ),
          0.25
        ),
        vec3.scale([], ne, 0.5 * we * (faceSizes[he.f] + faceSizes[twin.f]))
      );
      newPositions.push(edgePoint);
    }
  });

  // Build new vertex positions
  let m = newPositions.length; // Remember index where we started storing new vertex positions
  //let nEdgePoints = m - nFacePoints;
  //let debug = [];
  ds.vertex.forEach((he, i) => {
    let p = positions[he.v];
    let F = [0, 0, 0];
    let E = [0, 0, 0];
    let n = 0; // Number of edges around vertex
    let avgSize = 0;
    for (let edgeHe of ds.vertexCirculator(i)) {
      vec3.add(
        E,
        E,
        vec3.lerp([], p, positions[ds.halfedge[edgeHe.twin].v], 0.5)
      );
      vec3.add(F, F, faceCenters[edgeHe.f]);
      avgSize += faceSizes[edgeHe.f];
      n++;
    }
    vec3.scale(E, E, 1 / n);
    vec3.scale(F, F, 1 / n);
    avgSize /= n;
    he.iVertexPoint = newPositions.length;
    let vp = vec3.scale([], F, 1 + w2);
    vec3.add(vp, vp, vec3.scale([], E, 2 * (1 - w2 / 2)));
    vec3.add(vp, vp, vec3.scale([], p, n - 3));
    vec3.scale(vp, vp, 1 / n);
    vec3.add(vp, vp, vec3.scale([], vertexNormals[i], wp));
    newPositions.push(vp);
  });
  //let nVertexPoints = newPositions.length - m;
 

  let newFaces = [];
  ds.face.forEach((he, i) => {
    let edgeIndices = [];
    for (let he of ds.faceCirculator(i))
      edgeIndices.push(he.iEdgePoint, he.v + m);
    let ne = edgeIndices.length;
    for (let k = 0; k < ne; k += 2) {
      newFaces.push([
        i,
        edgeIndices[k],
        edgeIndices[(k + 1) % ne],
        edgeIndices[(k + 2) % ne]
      ]);
    }
  });

  let result = new Mesh(newPositions, newFaces);
  //result.debug = debug;
  return result;
}

