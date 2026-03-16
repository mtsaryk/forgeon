export type ProbeResult = {
  statusCode: number;
  body: unknown;
};

export type ProbeRequest = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
};

export type ProbeDefinition = {
  id: string;
  order: number;
  title: string;
  buttonLabel: string;
  resultTitle: string;
  path: string;
  request?: ProbeRequest;
};

const baseProbeDefinitions: ProbeDefinition[] = [
  {
    id: 'health',
    order: 10,
    title: 'API Health',
    buttonLabel: 'Check API health',
    resultTitle: 'Health response',
    path: '/health',
  },
  {
    id: 'error',
    order: 20,
    title: 'Error Envelope',
    buttonLabel: 'Check error envelope',
    resultTitle: 'Error probe response',
    path: '/health/error',
  },
  {
    id: 'validation',
    order: 30,
    title: 'Validation',
    buttonLabel: 'Check validation (expect 400)',
    resultTitle: 'Validation probe response',
    path: '/health/validation',
  },
];

const moduleProbeDefinitions: ProbeDefinition[] = [
  // forgeon:module-probes:start
  // forgeon:module-probes:end
];

function compareProbeOrder(left: ProbeDefinition, right: ProbeDefinition): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  return left.id.localeCompare(right.id);
}

export const probeDefinitions = [...baseProbeDefinitions, ...moduleProbeDefinitions].sort(compareProbeOrder);
