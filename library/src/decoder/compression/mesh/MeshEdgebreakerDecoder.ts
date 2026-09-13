// Ported from draco.js src/compression/mesh/MeshEdgebreakerDecoder.js (MIT)

import { MeshEdgebreakerConnectivityEncodingMethod } from '../config/CompressionShared'
import { MeshDecoder } from './MeshDecoder'
import { MeshEdgebreakerDecoderImpl } from './MeshEdgebreakerDecoderImpl'
import { MeshEdgebreakerTraversalDecoder } from './MeshEdgebreakerTraversalDecoder'
import { MeshEdgebreakerTraversalPredictiveDecoder } from './MeshEdgebreakerTraversalPredictiveDecoder'
import { MeshEdgebreakerTraversalValenceDecoder } from './MeshEdgebreakerTraversalValenceDecoder'

import type { MeshAttributeCornerTable } from '../../mesh/MeshAttributeCornerTable'
import type { CornerTable, MeshAttributeIndicesEncodingData } from './MeshEdgebreakerDecoderImpl'

class MeshEdgebreakerDecoder extends MeshDecoder {
  // Set by initializeDecoder(), which runs before anything below is reached.
  _impl: MeshEdgebreakerDecoderImpl | null = null

  override getCornerTable(): CornerTable | null {
    return this._impl!.getCornerTable()
  }

  override getAttributeCornerTable(attId: number): MeshAttributeCornerTable | null {
    return this._impl!.getAttributeCornerTable(attId)
  }

  override getAttributeEncodingData(attId: number): MeshAttributeIndicesEncodingData | null {
    return this._impl!.getAttributeEncodingData(attId)
  }

  override initializeDecoder(): boolean {
    const traversalDecoderType = this.buffer()!.decodeUint8()
    const TraversalDecoderClass =
      traversalDecoderType === MeshEdgebreakerConnectivityEncodingMethod.MESH_EDGEBREAKER_STANDARD_ENCODING
        ? MeshEdgebreakerTraversalDecoder
        : traversalDecoderType === MeshEdgebreakerConnectivityEncodingMethod.MESH_EDGEBREAKER_PREDICTIVE_ENCODING
          ? MeshEdgebreakerTraversalPredictiveDecoder
          : traversalDecoderType === MeshEdgebreakerConnectivityEncodingMethod.MESH_EDGEBREAKER_VALENCE_ENCODING
            ? MeshEdgebreakerTraversalValenceDecoder
            : null
    if (TraversalDecoderClass === null) {
      return false
    }
    this._impl = new MeshEdgebreakerDecoderImpl(this, TraversalDecoderClass)
    return true
  }

  override createAttributesDecoder(attDecoderId: number): boolean {
    return this._impl!.createAttributesDecoder(attDecoderId)
  }

  override decodeConnectivity(): boolean {
    return this._impl!.decodeConnectivity()
  }
}

export { MeshEdgebreakerDecoder }
