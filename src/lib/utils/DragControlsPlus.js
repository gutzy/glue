import {
    EventDispatcher,
    Matrix4,
    Plane,
    Raycaster,
    Vector2,
    Box3,
    Vector3
} from 'three';

const _plane = new Plane();
const _raycaster = new Raycaster();


const _pointer = new Vector2();
const _offset = new Vector3();
const _diff = new Vector2();
const _previousPointer = new Vector2();
const _intersection = new Vector3();
const _worldPosition = new Vector3();
const _inverseMatrix = new Matrix4();

const _up = new Vector3();
const _right = new Vector3();

class DragControlsPlus extends EventDispatcher {

    constructor( _objects, _camera, _domElement ) {

        super();

        _domElement.style.touchAction = 'none'; // disable touch scroll

        let _selected = null, _hovered = null;

        const _intersections = [];

        this.mode = 'translate';

        this.rotateSpeed = 1;

        //

        const scope = this;

        function activate() {

            _domElement.addEventListener( 'pointermove', onPointerMove );
            _domElement.addEventListener( 'pointerdown', onPointerDown );
            _domElement.addEventListener( 'pointerup', onPointerCancel );
            _domElement.addEventListener( 'pointerleave', onPointerCancel );

        }

        function deactivate() {

            _domElement.removeEventListener( 'pointermove', onPointerMove );
            _domElement.removeEventListener( 'pointerdown', onPointerDown );
            _domElement.removeEventListener( 'pointerup', onPointerCancel );
            _domElement.removeEventListener( 'pointerleave', onPointerCancel );

            _domElement.style.cursor = '';

        }

        function dispose() {

            deactivate();

        }

        function getObjects() {

            return _objects;

        }

        function setObjects( objects ) {

            _objects = objects;

        }

        function getRaycaster() {

            return _raycaster;

        }

        function onPointerMove( event ) {

            if ( scope.enabled === false ) return;

            updatePointer( event );

            _raycaster.setFromCamera( _pointer, _camera );

            if ( _selected ) {

                if ( scope.mode === 'translate' ) {

                    if ( _raycaster.ray.intersectPlane( _plane, _intersection ) ) {

                        _selected.position.copy( _intersection.sub( _offset ).applyMatrix4( _inverseMatrix ) );

                    }

                } else if ( scope.mode === 'rotate' ) {

                    _diff.subVectors( _pointer, _previousPointer ).multiplyScalar( scope.rotateSpeed );
                    _selected.rotateOnWorldAxis( _up, _diff.x );
                    _selected.rotateOnWorldAxis( _right.normalize(), - _diff.y );

                }

                scope.dispatchEvent( { type: 'drag', object: _selected } );

                _previousPointer.copy( _pointer );

            } else {

                // hover support

                if ( event.pointerType === 'mouse' || event.pointerType === 'pen' ) {

                    _intersections.length = 0;

                    _raycaster.setFromCamera( _pointer, _camera );
                    _raycaster.intersectObjects( _objects, scope.recursive, _intersections );

                    if ( _intersections.length > 0 ) {

                        const object = _intersections[ 0 ].object;

                        _plane.setFromNormalAndCoplanarPoint( _camera.getWorldDirection( _plane.normal ), _worldPosition.setFromMatrixPosition( object.matrixWorld ) );

                        if ( _hovered !== object && _hovered !== null ) {

                            scope.dispatchEvent( { type: 'hoveroff', object: _hovered } );

                            _domElement.style.cursor = 'auto';
                            _hovered = null;

                        }

                        if ( _hovered !== object ) {

                            scope.dispatchEvent( { type: 'hoveron', object: object } );

                            _domElement.style.cursor = 'pointer';
                            _hovered = object;

                        }

                    } else {

                        if ( _hovered !== null ) {

                            scope.dispatchEvent( { type: 'hoveroff', object: _hovered } );

                            _domElement.style.cursor = 'auto';
                            _hovered = null;

                        }

                    }

                }

            }

            _previousPointer.copy( _pointer );

        }

        function onPointerDown( event ) {

            if ( scope.enabled === false ) return;

            updatePointer( event );

            _intersections.length = 0;

            _raycaster.setFromCamera( _pointer, _camera );
            _raycaster.intersectObjects( _objects, scope.recursive, _intersections );

            if ( _intersections.length > 0 ) {

                if ( scope.transformGroup === true ) {

                    // look for the outermost group in the object's upper hierarchy

                    _selected = findGroup( _intersections[ 0 ].object );

                } else {

                    _selected = _intersections[ 0 ].object;

                }

                _plane.setFromNormalAndCoplanarPoint( _camera.getWorldDirection( _plane.normal ), _worldPosition.setFromMatrixPosition( _selected.matrixWorld ) );

                if ( _raycaster.ray.intersectPlane( _plane, _intersection ) ) {

                    if ( scope.mode === 'translate' ) {

                        _inverseMatrix.copy( _selected.parent.matrixWorld ).invert();
                        _offset.copy( _intersection ).sub( _worldPosition.setFromMatrixPosition( _selected.matrixWorld ) );

                    } else if ( scope.mode === 'rotate' ) {

                        // the controls only support Y+ up
                        _up.set( 0, 1, 0 ).applyQuaternion( _camera.quaternion ).normalize();
                        _right.set( 1, 0, 0 ).applyQuaternion( _camera.quaternion ).normalize();

                    }

                }

                _domElement.style.cursor = 'move';

                scope.dispatchEvent( { type: 'dragstart', object: _selected } );

            }

            _previousPointer.copy( _pointer );

        }

        function onPointerCancel() {

            if ( scope.enabled === false ) return;

            if ( _selected ) {

                scope.dispatchEvent( { type: 'dragend', object: _selected } );

                _selected = null;

            }

            _domElement.style.cursor = _hovered ? 'pointer' : 'auto';

        }

        function updatePointer( event ) {

            const rect = _domElement.getBoundingClientRect();

            _pointer.x = ( event.clientX - rect.left ) / rect.width * 2 - 1;
            _pointer.y = - ( event.clientY - rect.top ) / rect.height * 2 + 1;

        }

        function findGroup( obj, group = null ) {

            if ( obj.isGroup ) group = obj;

            if ( obj.parent === null ) return group;

            return findGroup( obj.parent, group );

        }

        // reset selected object programatically and start dragging it
        // reset selected object programmatically and start dragging it
// clientX/Y are viewport client coordinates (e.g. from a pointer/mouse event)
        const _bbox = new Box3();
        const _handleLocal = new Vector3();
        const _handleWorld = new Vector3();
        const _pivotWorld = new Vector3();

// clientX/Y are viewport coords from the UI that triggered the programmatic drag
        function resetSelected(obj, clientX, clientY, opts = {}) {
            if (_selected) scope.dispatchEvent({ type: 'dragend', object: _selected });

            _selected = obj;

            // recalculate offset by clientX/Y
            const rect = _domElement.getBoundingClientRect();
            _pointer.x = (clientX - rect.left) / rect.width * 2 - 1;
            _pointer.y = - (clientY - rect.top) / rect.height * 2 + 1;
            _raycaster.setFromCamera(_pointer, _camera);
            // intersect with infinite plane
            _raycaster.ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(
                _camera.getWorldDirection(new Vector3()).normalize(),
                _worldPosition.setFromMatrixPosition(_selected.matrixWorld)
            ), _intersection);

            console.log("Resetting selected object", _selected, "at", _intersection, _pointer.x, _pointer.y, _plane);

            // place object at intersection point
            _inverseMatrix.copy(_selected.parent.matrixWorld).invert();
            _offset.copy(_intersection).sub(_worldPosition.setFromMatrixPosition(_selected.matrixWorld));
            _selected.position.copy(_intersection);
            _selected.updateMatrixWorld(true);
            console.log("Selected object position after reset:", _selected.position);

            scope.dispatchEvent({ type: 'dragstart', object: _selected });
        }



        activate();

        this.enabled = true;
        this.recursive = true;
        this.transformGroup = false;

        this.resetSelected = resetSelected;
        this.activate = activate;
        this.deactivate = deactivate;
        this.dispose = dispose;
        this.getObjects = getObjects;
        this.getRaycaster = getRaycaster;
        this.setObjects = setObjects;

    }

}

export { DragControlsPlus };
