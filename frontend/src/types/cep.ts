/**
 * Constantes estatísticas, metadados das Regras de Nelson e tipos de renderização CEP.
 */

export const REGRAS_NELSON_METADATA: Record<
  string,
  { codigo: string; nome: string; descricao: string; severidade: 'CRITICA' | 'ALERTA' }
> = {
  REGRA_1: {
    codigo: 'REGRA_1',
    nome: '1 Ponto Além de 3 Sigma',
    descricao: 'Um único ponto fora dos limites de controle estatístico (além de LSC ou LIC).',
    severidade: 'CRITICA',
  },
  REGRA_2: {
    codigo: 'REGRA_2',
    nome: '9 Pontos Consecutivos no Mesmo Lado',
    descricao: 'Nove pontos seguidos do mesmo lado da Linha Central (LC), indicando deslocamento de média.',
    severidade: 'ALERTA',
  },
  REGRA_3: {
    codigo: 'REGRA_3',
    nome: '6 Pontos em Tendência Contínua',
    descricao: 'Seis pontos consecutivos estritamente crescentes ou estritamente decrescentes.',
    severidade: 'ALERTA',
  },
  REGRA_4: {
    codigo: 'REGRA_4',
    nome: '14 Pontos Alternando Direção',
    descricao: 'Quatorze pontos consecutivos oscilando para cima e para baixo continuamente.',
    severidade: 'ALERTA',
  },
  REGRA_5: {
    codigo: 'REGRA_5',
    nome: '2 de 3 Pontos na Zona A',
    descricao: 'Dois em cada três pontos sucessivos caem além de 2 sigma no mesmo lado da linha média.',
    severidade: 'ALERTA',
  },
  REGRA_6: {
    codigo: 'REGRA_6',
    nome: '4 de 5 Pontos na Zona B ou Além',
    descricao: 'Quatro em cada cinco pontos sucessivos caem além de 1 sigma no mesmo lado da linha média.',
    severidade: 'ALERTA',
  },
  REGRA_7: {
    codigo: 'REGRA_7',
    nome: '15 Pontos na Zona C (Estratificação)',
    descricao: 'Quinze pontos consecutivos dentro de 1 sigma da linha média (possível estratificação incorreta).',
    severidade: 'ALERTA',
  },
  REGRA_8: {
    codigo: 'REGRA_8',
    nome: '8 Pontos sem Presença na Zona C',
    descricao: 'Oito pontos consecutivos além de 1 sigma em qualquer lado da linha média.',
    severidade: 'ALERTA',
  },
}

export interface PontoCartaCEP {
  numero_subgrupo: number
  timestamp: string
  valor_medido: number
  dispersao: number
  valores_brutos: number[]
  fora_de_controle: boolean
  regras_violadas: string[]
}

export interface ZonasSigma {
  zonaA_superior: number // +3 sigma
  zonaB_superior: number // +2 sigma
  zonaC_superior: number // +1 sigma
  lc: number             // Linha Central
  zonaC_inferior: number // -1 sigma
  zonaB_inferior: number // -2 sigma
  zonaA_inferior: number // -3 sigma
}
