import { requirementList, type Equipment, type Skill } from '@/entities/task'
import type { AssignedTask, Metrics, PlanResponse, Route, Task, UnassignedTask } from '../model/types'


type Seed = {
  address: string
  district: string
  lat: number
  lon: number
  type_hd: string
  type_bk: string
  priority: string
  skills: string[]
  equipment: string[]
  service: number
}

const SEEDS: Seed[] = [
  { address: 'ул. Профсоюзная, 84 к. 2', district: 'ЮЗАО', lat: 55.6553, lon: 37.5415, type_hd: 'Авария', type_bk: 'Обрыв магистрали FTTB', priority: 'critical', skills: ['ВОЛС', 'Сварка'], equipment: ['Сварочный аппарат', 'Рефлектометр'], service: 100 },
  { address: 'Нахимовский пр-т, 45', district: 'ЮЗАО', lat: 55.6703, lon: 37.5605, type_hd: 'Подключение', type_bk: 'Новый абонент GPON', priority: 'normal', skills: ['GPON'], equipment: ['ONT'], service: 60 },
  { address: 'Ленинский пр-т, 102', district: 'ЮЗАО', lat: 55.6655, lon: 37.5066, type_hd: 'Ремонт', type_bk: 'Нет линка', priority: 'high', skills: ['Медь'], equipment: ['Тестер'], service: 45 },
  { address: 'Севастопольский пр-т, 22', district: 'ЮЗАО', lat: 55.6856, lon: 37.5942, type_hd: 'Доставка', type_bk: 'Дозаказ роутера', priority: 'low', skills: ['Wi-Fi'], equipment: ['Роутер'], service: 30 },
  { address: 'ул. Миклухо-Маклая, 15', district: 'ЮЗАО', lat: 55.6484, lon: 37.5171, type_hd: 'Подключение', type_bk: 'ТВ + интернет', priority: 'normal', skills: ['GPON', 'IPTV'], equipment: ['ONT', 'Приставка'], service: 75 },
  { address: 'ул. Вавилова, 69', district: 'ЮЗАО', lat: 55.6829, lon: 37.5605, type_hd: 'Ремонт', type_bk: 'Низкая скорость', priority: 'normal', skills: ['Wi-Fi'], equipment: ['Тестер'], service: 40 },
  { address: 'ул. Обручева, 30', district: 'ЮЗАО', lat: 55.6567, lon: 37.5282, type_hd: 'Подключение', type_bk: 'Бизнес-канал', priority: 'high', skills: ['ВОЛС'], equipment: ['Медиаконвертер'], service: 90 },
  { address: 'ул. Каховка, 27', district: 'ЮЗАО', lat: 55.6523, lon: 37.5747, type_hd: 'Ремонт', type_bk: 'ТО узла', priority: 'normal', skills: ['Медь'], equipment: ['Тестер'], service: 50 },
  { address: 'Варшавское ш., 87', district: 'ЮАО', lat: 55.6545, lon: 37.6205, type_hd: 'Подключение', type_bk: 'Новый абонент', priority: 'normal', skills: ['GPON'], equipment: ['ONT'], service: 60 },
  { address: 'ул. Большая Черкизовская, 5', district: 'ВАО', lat: 55.7961, lon: 37.7167, type_hd: 'Ремонт', type_bk: 'Нет ТВ', priority: 'normal', skills: ['IPTV'], equipment: ['Приставка'], service: 35 },
  { address: 'Балаклавский пр-т, 16', district: 'ЮАО', lat: 55.6412, lon: 37.5923, type_hd: 'Доставка', type_bk: 'Замена приставки', priority: 'low', skills: ['IPTV'], equipment: ['Приставка'], service: 25 },
  { address: 'ул. Архитектора Власова, 49', district: 'ЮЗАО', lat: 55.6766, lon: 37.5419, type_hd: 'Подключение', type_bk: 'Интернет 1 Гбит', priority: 'normal', skills: ['GPON'], equipment: ['ONT'], service: 60 },
  { address: 'ул. Гарибальди, 23', district: 'ЮЗАО', lat: 55.6718, lon: 37.5541, type_hd: 'Ремонт', type_bk: 'Повреждение кабеля', priority: 'high', skills: ['ВОЛС', 'Сварка'], equipment: ['Сварочный аппарат'], service: 70 },
  { address: 'ул. Академика Янгеля, 6', district: 'ЮАО', lat: 55.5967, lon: 37.5993, type_hd: 'Подключение', type_bk: 'Новый абонент', priority: 'normal', skills: ['Медь'], equipment: ['Модем'], service: 55 },
  { address: 'ул. Кржижановского, 14', district: 'ЮЗАО', lat: 55.6852, lon: 37.5776, type_hd: 'Доставка', type_bk: 'Дозаказ Wi-Fi mesh', priority: 'low', skills: ['Wi-Fi'], equipment: ['Роутер'], service: 30 },
  { address: 'Нахимовский пр-т, 4', district: 'ЮАО', lat: 55.6804, lon: 37.6043, type_hd: 'Ремонт', type_bk: 'Нет интернета', priority: 'high', skills: ['GPON'], equipment: ['ONT'], service: 45 },
  { address: 'ул. Намёткина, 10', district: 'ЮЗАО', lat: 55.6572, lon: 37.5586, type_hd: 'Подключение', type_bk: 'Офис B2B', priority: 'high', skills: ['ВОЛС'], equipment: ['Медиаконвертер'], service: 80 },
  { address: 'Ленинский пр-т, 131', district: 'ЗАО', lat: 55.6454, lon: 37.4775, type_hd: 'Ремонт', type_bk: 'ТО абонентской линии', priority: 'normal', skills: ['Медь'], equipment: ['Тестер'], service: 40 },
  { address: 'ул. Грина, 18', district: 'ЮЗАО', lat: 55.5696, lon: 37.5773, type_hd: 'Подключение', type_bk: 'ТВ + интернет', priority: 'normal', skills: ['GPON', 'IPTV'], equipment: ['ONT', 'Приставка'], service: 75 },
  { address: 'ул. Бутлерова, 12', district: 'ЮЗАО', lat: 55.6468, lon: 37.5381, type_hd: 'Доставка', type_bk: 'Возврат оборудования', priority: 'low', skills: [], equipment: [], service: 20 },
  { address: 'ул. Новаторов, 40', district: 'ЮЗАО', lat: 55.6708, lon: 37.5199, type_hd: 'Ремонт', type_bk: 'Плохой сигнал', priority: 'normal', skills: ['Wi-Fi'], equipment: ['Роутер'], service: 35 },
  { address: 'Профсоюзная ул., 128', district: 'ЮЗАО', lat: 55.6258, lon: 37.5104, type_hd: 'Подключение', type_bk: 'Новый абонент', priority: 'normal', skills: ['GPON'], equipment: ['ONT'], service: 60 },
  { address: 'ул. Островитянова, 9', district: 'ЮЗАО', lat: 55.6424, lon: 37.5207, type_hd: 'Авария', type_bk: 'Отказ коммутатора', priority: 'critical', skills: ['Сети'], equipment: ['Коммутатор'], service: 60 },
  { address: 'ул. Введенского, 23', district: 'ЮЗАО', lat: 55.6377, lon: 37.5476, type_hd: 'Подключение', type_bk: 'Интернет', priority: 'normal', skills: ['Медь'], equipment: ['Модем'], service: 50 },
]

const CREWS = [
  { id: 'eng-4', name: 'Бригада 4', transport: 'ГАЗель', start: 540, taskIdx: [1, 2, 0, 3, 4] },
  { id: 'eng-1', name: 'Бригада 1', transport: 'Ларгус', start: 510, taskIdx: [5, 6, 7, 11] },
  { id: 'eng-2', name: 'Бригада 2', transport: 'Пешком / метро', start: 540, taskIdx: [14, 12, 15, 10] },
  { id: 'eng-7', name: 'Бригада 7', transport: 'Авто', start: 510, taskIdx: [8, 13, 18, 21, 16, 22] },
  { id: 'eng-9', name: 'Бригада 9', transport: 'Ларгус', start: 570, taskIdx: [17, 20, 19] },
]

const UNASSIGNED: Array<{ idx: number; reason: string; explanation: string }> = [
  { idx: 9, reason: 'out_of_region', explanation: 'Адрес в ВАО, вне зоны обслуживания выбранного региона. Передайте заявку в региональную диспетчерскую.' },
  { idx: 23, reason: 'no_capacity', explanation: 'Все бригады с навыком «Медь» загружены до конца смены. Ближайший слот — завтра 09:00–11:00.' },
]

const TRAVEL = [18, 25, 22, 30, 15, 27, 20, 35]

const TIGHT_WINDOWS = new Set([16, 22])

const distanceKm = (a: Seed, b: Seed) => {
  const dx = (a.lon - b.lon) * 63
  const dy = (a.lat - b.lat) * 111
  return Math.sqrt(dx * dx + dy * dy) * 1.35
}

const SKILL_MAP: Record<string, Skill> = { ВОЛС: 'fttb', Сварка: 'fttb', GPON: 'fmc', Медь: 'basic', 'Wi-Fi': 'basic', IPTV: 'basic', Сети: 'gigabit' }
const EQUIPMENT_MAP: Record<string, Equipment> = {
  ONT: 'optics_kit',
  Тестер: 'cable_kit',
  'Сварочный аппарат': 'optics_kit',
  Рефлектометр: 'optics_kit',
  Роутер: 'router',
  Приставка: 'tv_box',
  Медиаконвертер: 'gigabit_kit',
  Модем: 'router',
  Коммутатор: 'gigabit_kit',
}

const mapUnique = <T,>(values: string[], map: Record<string, T>): T[] => [...new Set(values.map((v) => map[v]).filter(Boolean))]

function buildMock(): PlanResponse {
  const tasks: Task[] = SEEDS.map((s, i) => {
    const center = 600 + (i % 8) * 50
    return {
      id: 24790 + i,
      address: `Москва, ${s.address}`,
      district: s.district,
      lat: s.lat,
      lon: s.lon,
      priority: s.priority,
      required_equipment: mapUnique(s.equipment, EQUIPMENT_MAP),
      required_skills: [...mapUnique(s.skills, SKILL_MAP), ...(s.type_hd === 'Авария' ? (['emergency'] as Skill[]) : [])],
      service_time: s.service,
      tw_start: center - 90,
      tw_end: center + 90,
      type_bk: s.type_bk,
      type_hd: /Подключение|Доставка/.test(s.type_hd) ? '' : s.type_hd,
    }
  })

  const assigned: AssignedTask[] = []
  const routes: Route[] = CREWS.map((crew, ci) => {
    let clock = crew.start
    let km = 0
    const routeTasks = crew.taskIdx.map((idx, pos) => {
      const task = tasks[idx]
      const travel = TRAVEL[(ci + pos) % TRAVEL.length] * (crew.transport.startsWith('Пешком') ? 1.4 : 1)
      if (pos > 0) km += distanceKm(SEEDS[crew.taskIdx[pos - 1]], SEEDS[idx])
      const arrival = Math.round(clock + travel)
      task.tw_start = Math.floor((arrival - 30) / 30) * 30
      task.tw_end = TIGHT_WINDOWS.has(idx) ? arrival - 15 - (pos % 2) * 10 : task.tw_start + 120
      const start = Math.max(arrival, task.tw_start)
      const late = Math.max(0, start - task.tw_end)
      const end = start + task.service_time
      clock = end
      const reasons = [
        `Навыки «${requirementList(task.required_skills) || '—'}» есть у бригады`,
        task.required_equipment.length ? `оборудование (${requirementList(task.required_equipment)}) в наличии` : null,
        late ? `опоздание ${late} мин допущено: других свободных бригад с этими навыками нет` : 'прибытие в окне клиента',
        pos > 0 ? `ближайшая точка к предыдущей заявке маршрута` : 'первая точка маршрута от базы',
      ].filter(Boolean)
      assigned.push({
        task_id: task.id,
        engineer_id: crew.id,
        engineer_name: crew.name,
        position_in_route: pos + 1,
        priority: task.priority,
        arrival_min: arrival,
        start_min: start,
        end_min: end,
        late_min: late,
        tw_start: task.tw_start,
        tw_end: task.tw_end,
        explanation: reasons.join('; ') + '.',
      })
      return task
    })
    return {
      engineer_id: crew.id,
      engineer_name: crew.name,
      transport: crew.transport,
      distance_km: Math.round(km * 10) / 10,
      time_min: clock - crew.start,
      tasks: routeTasks,
    }
  })

  const unassigned: UnassignedTask[] = UNASSIGNED.map((u) => ({
    task_id: tasks[u.idx].id,
    reason: u.reason,
    explanation: u.explanation,
  }))

  const loads = routes.map((r) => r.time_min)
  const mean = loads.reduce((a, b) => a + b, 0) / loads.length
  const std = Math.sqrt(loads.reduce((a, b) => a + (b - mean) ** 2, 0) / loads.length)
  const late = assigned.filter((a) => a.late_min > 0)
  const total = assigned.length + unassigned.length

  const ml: Metrics = {
    status: 'OPTIMAL',
    total_tasks: total,
    assigned: assigned.length,
    unassigned: unassigned.length,
    assigned_rate: assigned.length / total,
    engineers_used: routes.length,
    late_count: late.length,
    total_late_min: late.reduce((s, a) => s + a.late_min, 0),
    overtime_min: loads.reduce((s, l) => s + Math.max(0, l - 480), 0),
    total_distance_km: Math.round(routes.reduce((s, r) => s + r.distance_km, 0) * 10) / 10,
    load_min: Math.min(...loads),
    load_max: Math.max(...loads),
    load_mean: Math.round(mean),
    load_std: Math.round(std * 10) / 10,
  }

  const baseline: Metrics = {
    ...ml,
    status: 'FEASIBLE',
    assigned: ml.assigned - 3,
    unassigned: ml.unassigned + 3,
    assigned_rate: (ml.assigned - 3) / total,
    late_count: ml.late_count + 4,
    total_late_min: ml.total_late_min + 96,
    overtime_min: ml.overtime_min + 55,
    total_distance_km: Math.round(ml.total_distance_km * 1.31 * 10) / 10,
    load_min: Math.round(ml.load_min * 0.6),
    load_max: Math.round(ml.load_max * 1.2),
    load_std: Math.round(ml.load_std * 1.9 * 10) / 10,
  }

  return { assigned, unassigned, routes, ml_metrics: ml, baseline_metrics: baseline }
}

export const mockPlan: PlanResponse = buildMock()

