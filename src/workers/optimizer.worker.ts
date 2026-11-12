/// <reference lib="webworker" />
// One optimizer worker. It prepares the same problem as the main thread, then searches the batches
// of work it is handed, using the best cut-off known when the batch was handed out.
import { loadCatalog } from '../data/catalog'
import { planUnits, prepareProblem, searchUnits } from '../engine/optimize/search'
import type { Prepared, Unit } from '../engine/optimize/search'
import type { OptimizerRequest, OptimizerResponse } from './optimizer-protocol'

const catalogReady = loadCatalog()
let prepared: Prepared | null = null
let units: Unit[] = []

const send = (message: OptimizerResponse) => self.postMessage(message)

self.onmessage = async (event: MessageEvent<OptimizerRequest>) => {
  try {
    const message = event.data
    if (message.type === 'start') {
      const catalog = await catalogReady
      prepared = prepareProblem(message.problem, catalog)
      units = planUnits(prepared)
      send({ type: 'ready', units: units.length })
      return
    }
    if (!prepared) throw new Error('The optimizer worker was asked to run before it was started.')
    const run = searchUnits(prepared, units.slice(message.from, message.to), {
      getCutoff: () => message.cutoff,
    })
    send({
      type: 'done',
      from: message.from,
      to: message.to,
      results: run.results,
      nodes: run.nodes,
    })
  } catch (error) {
    send({ type: 'error', message: (error as Error).message })
  }
}
