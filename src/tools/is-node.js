const isNode = typeof process === 'object' && Object.prototype.toString.call(process) === '[object process]'

export default isNode
