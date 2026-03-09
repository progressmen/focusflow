/**
 * 本地存储工具函数
 */

export const Storage = {
  /**
   * 获取存储的数据
   * @param {string} key - 存储键名
   * @param {any} defaultValue - 默认值
   * @returns {any} 存储的数据
   */
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error(`Failed to get ${key} from storage:`, error)
      return defaultValue
    }
  },

  /**
   * 设置存储数据
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的数据
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`Failed to set ${key} to storage:`, error)
    }
  },

  /**
   * 删除存储数据
   * @param {string} key - 存储键名
   */
  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Failed to remove ${key} from storage:`, error)
    }
  },

  /**
   * 清空所有存储数据
   */
  clear() {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  }
}

/**
 * 数据导出导入工具
 */
export const DataManager = {
  /**
   * 导出数据
   * @param {string[]} keys - 要导出的键名数组
   * @returns {Object} 导出的数据
   */
  export(keys = ['focusflow-data', 'focusflow-settings']) {
    const data = {}
    keys.forEach(key => {
      data[key] = Storage.get(key)
    })
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      data: data
    }
  },

  /**
   * 导入数据
   * @param {Object} exportedData - 导出的数据
   * @returns {boolean} 导入是否成功
   */
  import(exportedData) {
    try {
      if (!exportedData || !exportedData.data) {
        throw new Error('Invalid export data format')
      }

      Object.entries(exportedData.data).forEach(([key, value]) => {
        if (value !== undefined) {
          Storage.set(key, value)
        }
      })

      return true
    } catch (error) {
      console.error('Failed to import data:', error)
      return false
    }
  },

  /**
   * 下载数据文件
   * @param {Object} data - 要下载的数据
   * @param {string} filename - 文件名
   */
  download(data, filename = `focusflow-backup-${Date.now()}.json`) {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download data:', error)
    }
  }
}