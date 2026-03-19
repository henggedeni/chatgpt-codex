<template>
  <view class="page">
    <u-navbar title="uni-app 跨端骨架" bg-color="transparent" :auto-back="false" />

    <view class="hero">
      <text class="title">Vue3 + Vite + TypeScript</text>
      <text class="desc">uview-pro、crypto-js、z-paging 已完成基础接入</text>
    </view>

    <z-paging ref="pagingRef" v-model="dataList" :auto="false">
      <template #top>
        <u-notice-bar text="当前项目已预留 http / api / store / utils / upgrade / composables 目录" />
      </template>

      <view class="card">
        <text class="label">SHA256 示例：</text>
        <text class="value">{{ encryptedText }}</text>
      </view>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import CryptoJS from 'crypto-js'
import { computed, ref } from 'vue'

const pagingRef = ref()
const dataList = ref<string[]>([])

const encryptedText = computed(() =>
  CryptoJS.SHA256('uni-app-starter').toString(CryptoJS.enc.Hex),
)
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: linear-gradient(180deg, #f5f7fb 0%, #ffffff 100%);
}

.hero,
.card {
  margin-top: 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 40rpx rgba(15, 23, 42, 0.08);
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
  color: #111827;
}

.desc,
.label,
.value {
  display: block;
  margin-top: 16rpx;
  color: #4b5563;
  line-height: 1.6;
  word-break: break-all;
}
</style>
