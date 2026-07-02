import jsYaml from 'js-yaml'

export async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  }
}

export async function fetchYaml<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const text = await res.text()
    return jsYaml.load(text) as T
  } catch {
    return null
  }
}

export async function fetchText(path: string): Promise<string | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}
