/**
 * 时间相关工具函数
 */

/**
 * 获取当前时间对应的整10分钟时间戳
 * @param {number} time - 时间戳，默认使用当前时间
 * @returns {number} 整10分钟的时间戳
 */
export function getRoundedTime(time = Date.now()) {
  return Math.floor(time / (10 * 60 * 1000)) * (10 * 60)
}

/**
 * 获取今天到现在为止的所有的整10分钟级时间戳数组
 * 
 */
export function getTodayRoundedTimes(time = Date.now()) {
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const times = []
  for (let t = todayStart; t <= time; t += 10 * 60 * 1000) {
    times.push(getRoundedTime(t))
  }
  return times
}

/**
 * 获取某个日期所有的整10分钟级时间戳数组
 * 
 */
export function getDayRoundedTimes(dayTimeStr) {
  const todayStart = new Date(dayTimeStr).setHours(0, 0, 0, 0)
  const todayEnd = new Date(dayTimeStr).setHours(23, 59, 59, 59)
  
  const times = []
  for (let t = todayStart; t <= todayEnd; t += 10 * 60 * 1000) {
    times.push(getRoundedTime(t))
  }
  return times
}