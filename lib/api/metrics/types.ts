import { SomeJSONSchema } from 'ajv/dist/types/json-schema'
import { ApiResponse, PaginatedApiRequest } from '../base'

export const SeriesTypeValues = ['category', 'value', 'time'] as const
export type SeriesType = (typeof SeriesTypeValues)[number]

export type Series = {
  id: string
  type: SeriesType
  values: (number | string)[]
}

export type GraphNode = {
  name: string,
  color?: string,
  type: string,
  x?: number, 
  y?: number
}

export type GraphLink = {
  from: string,
  to: string,
  distance?: number,
  color?: string
}

export type DailySkus = {
  name: string,
  mode: string,
  quantity: number
}

export type GraphActiveLink = GraphLink & {
  skus: DailySkus[]
}

export type Category = {
  name: string,
  type: string,
  icon: string,
  style: {
    color: string
  }
}

export type SankeyLink = {
  source: string,
  target: string,
  value: number
}

export type SankeySeries = {
  id: string,
  type: SeriesType,
  values: (string[] | SankeyLink[])
}

export type GraphElement = GraphNode | GraphLink | GraphActiveLink | Category


export type GraphSeries = {
  id: string,
  type: SeriesType
  values: GraphElement[]
}

export type SKUData= {
  name: string,
  values: number[]
}

export type BarChartMultiSeries = {
  id: string,
  type: SeriesType,
  values: number[] | SKUData[]
}

export const MetricScopeValues = [
  'system',
  'asset',
  'model',
  'inference',
] as const
export type MetricScopeType = (typeof MetricScopeValues)[number]

export type MetricComputeType = {
  id: string
  name: string
  icon: string
  configSchema: SomeJSONSchema
}

export type MetricType = {
  id: string
  usecaseId: string
  name: string
  description: string
  scope: MetricScopeType
  computeTypeId: string
  config: Record<string, any>
  valueSchema: SomeJSONSchema
  paramsSchema: SomeJSONSchema
  computeType: MetricComputeType
}

export type Metric = {
  metricTypeId: string
  metricType?: MetricType
  value: Series[]
}

export type ComputeMetricTypeRequest = {
  metricTypeId: string
  params?: Record<string, any>
}
export type ComputeMetricTypeResponse = ApiResponse<Metric>

export type ListMetricTypesResponse = ApiResponse<MetricType[]>
export type ListMetricComputeTypesResponse = ApiResponse<MetricComputeType[]>
export type GetMetricTypeResponse = ApiResponse<MetricType>
export type GetMetricTypeRequest = { metricTypeId: string }
export type ListMetricTypesRequest = PaginatedApiRequest<{
  scope?: MetricScopeType
  computeTypeId?: string
  usecaseId?: string
  searchText?: string
}>
