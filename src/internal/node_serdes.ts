export class SerializerContext {
    throwDataCloneError(message: string) {
        const error = (this as any)._getDataCloneError(message)
        
        if (error == null) return
        
        throw error
    }

    getSharedArrayBufferId(sharedArrayBuffer: SharedArrayBuffer) {
        const id = (this as any)._getSharedArrayBufferId(sharedArrayBuffer)

        if (id == null) return null
        
        return id | 0
    }

    writeHostObject(input: object) {

    }
}