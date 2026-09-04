<template>
  <div class="space-y-3 pb-6">

    <!-- Workflow mode gate -->
    <div v-if="!authStore.hasWorkflowMode" class="card text-center py-8">
      <div class="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center" style="background:#eef2ff;">
        <svg class="w-6 h-6" style="color:#696CFF;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m0 6h4m-4 4h4m-9 1h.01M12 12h.01"/>
        </svg>
      </div>
      <p class="text-sm font-semibold text-[#09090b] mb-1">เลือกโหมดการทำงาน</p>
      <p class="text-xs text-zinc-400 mb-4">เลือกครั้งเดียว ระบบจะจำไว้ให้เครื่องนี้ (เปลี่ยนภายหลังได้)</p>
      <div class="flex flex-col gap-2 max-w-xs mx-auto">
        <button @click="authStore.selectWorkflowMode('checkpoint')"
          class="py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style="background:#696CFF; box-shadow:0 2px 8px -3px rgba(105,108,255,0.5);">
          Checkpoint <span class="font-normal opacity-80">(สแกนหน้างาน เช่น X-ray)</span>
        </button>
        <button @click="authStore.selectWorkflowMode('recheck')"
          class="py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style="background:#22c55e; box-shadow:0 2px 8px -3px rgba(34,197,94,0.5);">
          Lab Recheck
        </button>
      </div>
    </div>

    <template v-else>

    <!-- Mode indicator + switch -->
    <div class="flex items-center justify-between px-1">
      <span class="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        โหมด:
        <span :style="authStore.isRecheckMode ? 'color:#15803d;' : 'color:#4338ca;'">
          {{ authStore.isRecheckMode ? 'Lab Recheck' : 'Checkpoint' }}
        </span>
      </span>
      <button @click="confirmChangeWorkflowMode" class="text-[11px] text-zinc-400 hover:text-zinc-600 underline underline-offset-2">เปลี่ยนโหมด</button>
    </div>

    <!-- CNGroup bar -->
    <div class="flex items-center gap-2">
      <div class="flex-1 flex flex-wrap gap-1.5 min-h-[28px] items-center">
        <template v-if="authStore.selectedCNGroup && !showCNGroupSelect">
          <span class="badge-primary">
            <span class="w-1.5 h-1.5 rounded-full" style="background:#22c55e;"></span>
            {{ cnGroupName(authStore.selectedCNGroup) }}
          </span>
        </template>
        <span v-else-if="!showCNGroupSelect" class="text-xs text-zinc-400">ยังไม่ได้เลือก CNGroup</span>
      </div>

      <button
        @click="toggleCNGroupPanel"
        class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
        :class="showCNGroupSelect ? 'text-emerald-700' : 'bg-white text-zinc-500 hover:text-zinc-800'"
        :style="showCNGroupSelect
          ? 'background:#ecfdf5; border:1px solid #a7f3d0;'
          : 'border:1px solid rgba(9,9,11,0.08); box-shadow:0 1px 2px rgba(9,9,11,0.04);'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 3c0-1.1-.9-2-2-2M3 15c0-1.1.9-2 2-2"/>
        </svg>
        CNGroup
        <span v-if="authStore.selectedCNGroup"
          class="w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
          style="background:#22c55e;">
          ✓
        </span>
      </button>
    </div>

    <!-- CNGroup select panel -->
    <div v-if="showCNGroupSelect" class="card animate-in">
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm font-semibold text-[#09090b]">เลือก CNGroup</p>
        <span class="text-xs text-zinc-400">{{ authStore.selectedCNGroup ? cnGroupName(authStore.selectedCNGroup) : '' }}</span>
      </div>

      <div class="relative mb-2">
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          v-model="cnGroupSearch"
          type="text"
          placeholder="ค้นหา CNGroup..."
          class="input w-full text-xs py-1.5 pl-8 pr-3"
          @input="onCNGroupSearch"
        />
      </div>

      <div v-if="isLoadingCNGroups" class="flex justify-center py-5">
        <div class="w-5 h-5 border-2 border-zinc-100 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
      <div v-else-if="cnGroups.length === 0" class="text-center py-5 text-zinc-400 text-xs">ไม่พบ CNGroup</div>
      <div v-else class="space-y-0.5 max-h-52 overflow-y-auto -mx-1 px-1">
        <div
          v-for="group in cnGroups" :key="group.id"
          @click="selectCNGroup(group)"
          class="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all select-none"
          :class="authStore.selectedCNGroup?.id === group.id
            ? 'text-[#09090b]'
            : 'hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900'"
          :style="authStore.selectedCNGroup?.id === group.id ? 'background:#ecfdf5;' : ''"
        >
          <div class="w-4 h-4 rounded-full shrink-0 transition-all box-border"
            :class="authStore.selectedCNGroup?.id === group.id ? '' : 'border-2 border-zinc-300'"
            :style="authStore.selectedCNGroup?.id === group.id ? 'border:5px solid #10b981; background:#fff;' : ''">
          </div>
          <p class="flex-1 text-sm truncate">{{ group.name }}</p>
          <span v-if="group.code" class="shrink-0 px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-100 text-zinc-400 border border-zinc-200">{{ group.code }}</span>
        </div>
      </div>
    </div>

    <!-- Warning: no cngroup -->
    <div v-if="!showCNGroupSelect && !authStore.hasCNGroup"
      class="flex items-center gap-2 px-3 py-2 rounded-xl"
      style="background:#fffbeb; border:1px solid #fde68a;">
      <svg class="w-3.5 h-3.5 shrink-0" style="color:#FFAB00;" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <p class="text-xs flex-1" style="color:#92400e;">กรุณาเลือก CNGroup ก่อนสแกน</p>
      <button @click="toggleCNGroupPanel" class="text-xs font-semibold underline underline-offset-2" style="color:#92400e;">เลือก</button>
    </div>

    <template v-if="!authStore.isRecheckMode">

    <!-- Station bar -->
    <div class="flex items-center gap-2">
      <div class="flex-1 flex flex-wrap gap-1.5 min-h-[28px] items-center">
        <template v-if="authStore.selectedStations.length > 0 && !showStationSelect">
          <span v-for="s in authStore.selectedStations" :key="s.id" class="badge-primary">
            <span class="w-1.5 h-1.5 rounded-full" style="background:#696CFF;"></span>
            {{ stationName(s) }}
          </span>
        </template>
        <span v-else-if="!showStationSelect" class="text-xs text-zinc-400">ยังไม่ได้เลือกจุดตรวจ</span>
      </div>

      <button
        @click="toggleStationPanel"
        class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
        :class="showStationSelect ? 'text-indigo-700' : 'bg-white text-zinc-500 hover:text-zinc-800'"
        :style="showStationSelect
          ? 'background:#eef2ff; border:1px solid #c7d2fe;'
          : 'border:1px solid rgba(9,9,11,0.08); box-shadow:0 1px 2px rgba(9,9,11,0.04);'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        จุดตรวจ
        <span v-if="authStore.selectedStations.length > 0"
          class="w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
          style="background:#696CFF;">
          {{ authStore.selectedStations.length }}
        </span>
      </button>
    </div>

    <!-- Station select panel -->
    <div v-if="showStationSelect" class="card animate-in">
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm font-semibold text-[#09090b]">เลือกจุดตรวจ</p>
        <div class="flex items-center gap-2">
          <span class="text-xs text-zinc-400">
            {{ authStore.selectedStations.length > 0 ? `เลือก ${authStore.selectedStations.length} จุด` : '' }}
          </span>
          <button v-if="authStore.selectedStations.length > 0"
            @click="authStore.clearStations()"
            class="text-[11px] font-medium transition-colors px-2 py-0.5 rounded-lg"
            style="color:#ef4444; background:#fff5f5; border:1px solid #fecaca;">
            ล้างทั้งหมด
          </button>
        </div>
      </div>

      <div class="relative mb-2">
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          v-model="stationSearch"
          type="text"
          placeholder="ค้นหาจุดตรวจ..."
          class="input w-full text-xs py-1.5 pl-8 pr-3"
          @input="onStationSearch"
        />
      </div>

      <div v-if="isLoadingStations" class="flex justify-center py-5">
        <div class="w-5 h-5 border-2 border-zinc-100 border-t-[#696CFF] rounded-full animate-spin"></div>
      </div>
      <div v-else-if="stations.length === 0" class="text-center py-5 text-zinc-400 text-xs">ไม่พบจุดตรวจ</div>
      <div v-else class="space-y-0.5 max-h-52 overflow-y-auto -mx-1 px-1">
        <div
          v-for="station in stations" :key="station.id"
          @click="authStore.toggleStation(station)"
          class="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all select-none"
          :class="authStore.isStationSelected(station.id)
            ? 'text-[#09090b]'
            : 'hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900'"
          :style="authStore.isStationSelected(station.id) ? 'background:#eef2ff;' : ''"
        >
          <div class="w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center transition-all"
            :class="authStore.isStationSelected(station.id) ? 'border-[#696CFF]' : 'border-zinc-300'"
            :style="authStore.isStationSelected(station.id) ? 'background:#696CFF;' : ''">
            <svg v-if="authStore.isStationSelected(station.id)" class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <p class="flex-1 text-sm truncate">{{ station.name }}</p>
          <span class="shrink-0 px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-100 text-zinc-400 border border-zinc-200">#{{ station.id }}</span>
          <span v-if="station.isSpecial" class="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 border border-amber-100">พิเศษ</span>
        </div>
      </div>
    </div>

    <!-- Warning: no station -->
    <div v-if="!showStationSelect && !isReady"
      class="flex items-center gap-2 px-3 py-2 rounded-xl"
      style="background:#fffbeb; border:1px solid #fde68a;">
      <svg class="w-3.5 h-3.5 shrink-0" style="color:#FFAB00;" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <p class="text-xs flex-1" style="color:#92400e;">กรุณาเลือกจุดตรวจก่อนสแกน</p>
      <button @click="toggleStationPanel" class="text-xs font-semibold underline underline-offset-2" style="color:#92400e;">เลือก</button>
    </div>

    <!-- Scanner Status -->
    <div
      class="relative overflow-hidden rounded-2xl p-4 transition-all duration-500"
      :style="isReady
        ? 'background:linear-gradient(135deg,#696CFF 0%,#5558e3 100%); border:1px solid rgba(105,108,255,0.3); box-shadow:0 4px 20px -6px rgba(105,108,255,0.55),0 1px 3px rgba(9,9,11,0.08);'
        : 'background:#fff; border:1px solid rgba(9,9,11,0.07); box-shadow:0 1px 2px rgba(9,9,11,0.04),0 4px 12px -4px rgba(9,9,11,0.06);'"
    >
      <div v-if="isReady" class="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none" style="background:rgba(255,255,255,0.08);"></div>
      <div v-if="isReady" class="absolute top-2 right-10 w-16 h-16 rounded-full pointer-events-none" style="background:rgba(255,255,255,0.05);"></div>

      <div class="relative flex items-center gap-4">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500"
          :style="isReady ? 'background:rgba(255,255,255,0.15);' : 'background:#f4f4f6;'"
        >
          <svg class="w-7 h-7 transition-colors" :class="isReady ? 'text-white' : 'text-zinc-400'"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
        </div>

        <div class="flex-1">
          <p class="font-semibold text-sm" :class="isReady ? 'text-white' : 'text-[#09090b]'">
            {{ isReady ? 'พร้อมรับการสแกน' : 'ยังไม่พร้อม' }}
          </p>
          <p class="text-xs mt-0.5" :class="isReady ? 'text-indigo-200/80' : 'text-zinc-400'">
            {{ isReady ? 'สแกนบาร์โค้ดผู้ป่วยได้เลย' : 'เลือกจุดตรวจก่อน' }}
          </p>
        </div>

        <div
          class="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          :style="isReady
            ? 'background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.2); color:#fff;'
            : 'background:#f4f4f6; border:1px solid rgba(9,9,11,0.08); color:#71717a;'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="isReady ? 'animate-pulse' : 'bg-zinc-300'"
            :style="isReady ? 'background:#71DD37;' : ''"></span>
          Checkup
        </div>
      </div>
    </div>

    <!-- Last Result -->
    <div class="card">
      <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">ผลล่าสุด</p>

      <div v-if="!scannerStore.lastScan" class="py-0.5">
        <span class="text-xs text-zinc-400">ยังไม่มีการสแกน</span>
      </div>

      <div v-else-if="!scannerStore.lastScan.success"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style="background:#fff5f5; border:1px solid #fecaca;">
        <div class="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center" style="background:#fee2e2;">
          <svg class="w-4 h-4" style="color:#FF5151;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm" style="color:#b91c1c;">{{ scannerStore.lastScan.error }}</p>
          <p class="text-[10px] text-zinc-400 mt-0.5">{{ formatTime(scannerStore.lastScan.timestamp) }}</p>
        </div>
        <span class="badge-danger">ผิดพลาด</span>
      </div>

      <div v-else class="rounded-xl border overflow-hidden"
        :style="scannerStore.lastScan.cancelled
          ? 'background:#fafafa; border-color:#e4e4e7;'
          : scannerStore.lastScan.isNewScan === false
            ? 'background:#fffbeb; border-color:#fde68a;'
            : 'background:#f0fdf4; border-color:#bbf7d0;'"
      >
        <div class="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <span v-if="scannerStore.lastScan.cancelled" class="badge-zinc">ยกเลิกแล้ว</span>
          <span v-else-if="scannerStore.lastScan.isNewScan === false" class="badge-amber">ซ้ำ</span>
          <span v-else class="badge-success">ใหม่</span>

          <span class="text-[10px] text-zinc-400 flex-1">{{ scannerStore.lastScan.data?.station?.name }}</span>
          <span class="text-[10px] text-zinc-400">{{ formatTime(scannerStore.lastScan.timestamp) }}</span>

          <button
            v-if="!scannerStore.lastScan.cancelled && scannerStore.lastScan.scanId"
            @click="scannerStore.cancelScan(scannerStore.lastScan)"
            :disabled="scannerStore.cancellingId === scannerStore.lastScan.scanId"
            class="shrink-0 px-2 py-0.5 rounded-lg text-[11px] font-medium disabled:opacity-40 transition-all"
            style="color:#FF5151; border:1px solid #fecaca;"
          >
            {{ scannerStore.cancellingId === scannerStore.lastScan.scanId ? '...' : 'ยกเลิก' }}
          </button>
        </div>

        <div class="px-3 pb-2.5 space-y-0.5">
          <p class="font-semibold text-sm" :class="scannerStore.lastScan.cancelled ? 'text-zinc-400 line-through' : 'text-[#09090b]'">
            {{ scannerStore.lastScan.patientName }}
          </p>
          <div class="flex items-center gap-3 flex-wrap">
            <span v-if="scannerStore.lastScan.data?.patient?.hn" class="text-[11px] text-zinc-500">HN: {{ scannerStore.lastScan.data.patient.hn }}</span>
            <span v-if="scannerStore.lastScan.data?.membership?.cn" class="text-[11px] text-zinc-500">CN: {{ scannerStore.lastScan.data.membership.cn }}</span>
          </div>
          <p v-if="scannerStore.lastScan.data?.membership?.department || scannerStore.lastScan.data?.membership?.companyName"
            class="text-[11px] text-zinc-400 truncate">
            {{ [scannerStore.lastScan.data?.membership?.department, scannerStore.lastScan.data?.membership?.companyName].filter(Boolean).join(' · ') }}
          </p>
          <p v-if="scannerStore.lastScan.message" class="text-[11px] text-zinc-500 leading-snug pt-0.5">
            {{ scannerStore.lastScan.message }}
          </p>
        </div>
      </div>
    </div>

    <!-- History -->
    <div class="card">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
          ประวัติ
          <span v-if="scannerStore.scanHistory.length" class="normal-case text-zinc-300 ml-0.5">· {{ scannerStore.scanHistory.length }}</span>
        </p>
        <button v-if="scannerStore.scanHistory.length"
          @click="scannerStore.clearHistory"
          class="text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors">ล้าง</button>
      </div>

      <div v-if="!scannerStore.scanHistory.length" class="flex items-center gap-2 py-0.5">
        <svg class="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="text-xs text-zinc-400">ไม่มีประวัติ</span>
      </div>

      <div v-else class="space-y-0.5 max-h-48 overflow-y-auto">
        <div
          v-for="(scan, i) in scannerStore.recentScans" :key="i"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group"
          :class="scan.cancelled ? 'opacity-50' : scan.success ? 'hover:bg-zinc-50' : ''"
          :style="!scan.success && !scan.cancelled ? 'background:#fff5f5;' : ''"
        >
          <div class="w-1.5 h-1.5 rounded-full shrink-0"
            :style="scan.cancelled ? 'background:#d4d4d8;' : scan.success ? 'background:#71DD37;' : 'background:#FF5151;'">
          </div>
          <span class="flex-1 truncate text-xs"
            :class="scan.cancelled ? 'text-zinc-400 line-through' : scan.success ? 'text-zinc-700' : ''"
            :style="!scan.success && !scan.cancelled ? 'color:#FF5151;' : ''">
            {{ scan.patientName || scan.error }}
          </span>
          <span v-if="scan.data?.station?.name"
            class="shrink-0 text-[10px] text-zinc-400 truncate max-w-[72px]">
            {{ scan.data.station.name }}
          </span>
          <span class="text-[10px] text-zinc-400 shrink-0">{{ formatTime(scan.timestamp, true) }}</span>
          <button
            v-if="scan.success && !scan.cancelled && scan.scanId"
            @click="scannerStore.cancelScan(scan)"
            :disabled="scannerStore.cancellingId === scan.scanId"
            class="shrink-0 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[10px] font-medium disabled:opacity-40 transition-all"
            style="color:#FF5151; border:1px solid #fecaca;"
          >
            {{ scannerStore.cancellingId === scan.scanId ? '...' : 'ยกเลิก' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Log Panel -->
    <div class="card">
      <div class="flex items-center justify-between cursor-pointer select-none" @click="showLogs = !showLogs">
        <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          logs
          <span v-if="logStore.entries.length" class="normal-case font-normal text-zinc-300">· {{ logStore.entries.length }}</span>
          <span v-if="logStore.errorCount"
            class="px-1.5 py-0.5 rounded text-[9px] font-bold"
            style="background:#fff5f5; color:#FF5151; border:1px solid #fecaca;">
            {{ logStore.errorCount }} err
          </span>
        </p>
        <div class="flex items-center gap-2">
          <button v-if="logStore.entries.length && showLogs" @click.stop="logStore.clear()"
            class="text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors">ล้าง</button>
          <svg class="w-3.5 h-3.5 text-zinc-300 transition-transform duration-200"
            :class="showLogs ? 'rotate-180' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>

      <div v-if="showLogs" class="mt-2 max-h-52 overflow-y-auto space-y-0">
        <div v-if="!logStore.entries.length" class="text-xs text-zinc-400 py-0.5">ไม่มี logs</div>
        <div v-for="entry in logStore.entries" :key="entry.id"
          class="py-1.5 border-b border-zinc-50 last:border-0">
          <div class="flex items-start gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full shrink-0 mt-1" :style="logDotColor(entry.level)"></span>
            <span class="text-[10px] text-zinc-400 shrink-0 tabular-nums font-mono">{{ formatLogTime(entry.time) }}</span>
            <span class="text-[11px] flex-1 min-w-0 break-all leading-snug" :style="logTextColor(entry.level)">{{ entry.message }}</span>
          </div>
          <div v-if="entry.detail"
            class="ml-3.5 mt-0.5 text-[10px] text-zinc-400 break-all leading-tight font-mono whitespace-pre-wrap">{{ entry.detail }}</div>
        </div>
      </div>
    </div>

    <!-- Scan panel -->
    <div class="card">

      <div class="flex gap-2 mb-3">
        <!-- Auto / Manual -->
        <div class="flex gap-0.5 p-1 rounded-xl flex-1 bg-zinc-100">
          <button
            disabled
            title="ปิดใช้งานชั่วคราว: auto mode"
            class="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 opacity-40 cursor-not-allowed text-zinc-400"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Auto
          </button>
          <button
            @click="authStore.scanInputMode !== 'manual' && authStore.toggleScanInputMode()"
            class="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
            :class="authStore.scanInputMode !== 'manual' && 'text-zinc-400 hover:text-zinc-600'"
            :style="authStore.scanInputMode === 'manual' ? 'background:#03C3EC; color:#fff;' : ''"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"/>
            </svg>
            Manual
          </button>
        </div>
      </div>

      <div class="flex gap-2">
        <input
          v-model="testBarcode"
          type="text"
          class="input flex-1 text-xs py-2"
          placeholder="พิมพ์หรือสแกน barcode"
          @keydown.enter="runTestScan"
        />
        <button
          @click="runTestScan"
          :disabled="!testBarcode || isTestLoading"
          class="shrink-0 px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-40 transition-all"
          style="background:#696CFF; box-shadow:0 2px 8px -3px rgba(105,108,255,0.5);"
        >
          {{ isTestLoading ? '...' : 'สแกน' }}
        </button>
      </div>
    </div>

    <!-- Remark Card -->
    <div class="card">
      <div class="flex items-center gap-2 mb-3">
        <svg class="w-3.5 h-3.5 shrink-0" style="color:#696CFF;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
        <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">เพิ่มหมายเหตุ</p>
      </div>

      <div class="space-y-3">

        <!-- ค้นหา -->
        <div class="flex gap-2">
          <input v-model="remarkForm.cn" type="text" class="input flex-1 text-xs py-2"
            placeholder="CN.จุดตรวจ เช่น 691220014.16"
            @keydown.enter="lookupPatient" />
          <button @click="lookupPatient" :disabled="!remarkForm.cn || isLookingUp"
            class="shrink-0 px-3 rounded-xl text-white disabled:opacity-40 transition-all"
            style="background:#696CFF; box-shadow:0 2px 8px -3px rgba(105,108,255,0.5);">
            <svg v-if="!isLookingUp" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </button>
        </div>

        <!-- Step 2: ผลการค้นหา -->
        <div v-if="foundPatient" class="space-y-2">
          <div class="rounded-xl overflow-hidden" style="border:1px solid #e4e4e7;">
            <!-- ชื่อผู้ป่วย -->
            <div class="px-3 py-2.5" style="background:#fafafa;">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-zinc-800">{{ foundPatient.name }}</p>
                  <div class="flex gap-2.5 mt-0.5 flex-wrap">
                    <span v-if="foundPatient.hn" class="text-[10px] text-zinc-400">HN {{ foundPatient.hn }}</span>
                    <span class="text-[10px] text-zinc-400">CN {{ foundPatient.cn }}</span>
                  </div>
                </div>
                <span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  :style="foundPatient.hasExamAtStation
                    ? 'background:#dcfce7; color:#15803d;'
                    : 'background:#fef3c7; color:#b45309;'">
                  {{ foundPatient.hasExamAtStation ? 'มีรายการตรวจ' : 'ไม่มีรายการตรวจ' }}
                </span>
              </div>
              <!-- รหัสพนักงาน / ตำแหน่ง / แผนก / บริษัท -->
              <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                <div v-if="foundPatient.employeeCode">
                  <p class="text-[9px] text-zinc-400 uppercase tracking-wide">รหัสพนักงาน</p>
                  <p class="text-[10px] text-zinc-600 font-medium">{{ foundPatient.employeeCode }}</p>
                </div>
                <div v-if="foundPatient.position">
                  <p class="text-[9px] text-zinc-400 uppercase tracking-wide">ตำแหน่ง</p>
                  <p class="text-[10px] text-zinc-600 font-medium">{{ foundPatient.position }}</p>
                </div>
                <div v-if="foundPatient.department">
                  <p class="text-[9px] text-zinc-400 uppercase tracking-wide">แผนก</p>
                  <p class="text-[10px] text-zinc-600 font-medium">{{ foundPatient.department }}</p>
                </div>
                <div v-if="foundPatient.companyName">
                  <p class="text-[9px] text-zinc-400 uppercase tracking-wide">บริษัท</p>
                  <p class="text-[10px] text-zinc-600 font-medium">{{ foundPatient.companyName }}</p>
                </div>
              </div>
            </div>
            <!-- จุดตรวจ + รายการ -->
            <div class="px-3 py-2 border-t" style="border-color:#f0f0f0;">
              <div class="flex items-center gap-1.5 mb-1.5">
                <svg class="w-3 h-3 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                </svg>
                <span class="text-[10px] font-medium text-zinc-600">{{ foundPatient.station?.name || '-' }}</span>
              </div>
              <div v-if="foundPatient.examItems?.length" class="flex flex-wrap gap-1">
                <span v-for="item in foundPatient.examItems" :key="item.id"
                  class="px-1.5 py-0.5 rounded text-[10px] leading-tight"
                  style="background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe;">
                  {{ item.name }}<span v-if="item.nameEn" class="opacity-60"> · {{ item.nameEn }}</span>
                </span>
              </div>
              <p v-else class="text-[10px] text-zinc-400">ไม่มีรายการตรวจที่จุดนี้</p>
            </div>
          </div>

          <!-- Step 3: กรอกหมายเหตุ (เฉพาะเมื่อมีรายการตรวจ) -->
          <template v-if="foundPatient.hasExamAtStation">
            <div class="space-y-2">
              <p class="text-[10px] font-medium text-zinc-400">บันทึกหมายเหตุ</p>
              <select v-model="remarkForm.reasonId" class="input text-xs py-2 w-full"
                @focus="window.api.setScanPaused(true)" @blur="window.api.setScanPaused(false)">
                <option value="">-- เลือกเหตุผล (ไม่บังคับ) --</option>
                <option v-for="r in remarkReasons" :key="r.id" :value="r.id">{{ r.title }}</option>
              </select>
              <textarea v-model="remarkForm.remark" class="input text-xs py-2 w-full resize-none" rows="2"
                placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
                @focus="window.api.setScanPaused(true)" @blur="window.api.setScanPaused(false)"></textarea>
              <div class="flex gap-2">
                <button @click="submitRemark" :disabled="isSavingRemark"
                  class="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all"
                  style="background:#696CFF; box-shadow:0 2px 8px -3px rgba(105,108,255,0.5);">
                  {{ isSavingRemark ? 'กำลังบันทึก...' : 'บันทึกหมายเหตุ' }}
                </button>
                <button v-if="foundPatient.existingRemark"
                  @click="deleteRemark" :disabled="isDeletingRemark"
                  class="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition-all"
                  style="color:#ef4444; background:#fff5f5; border:1px solid #fecaca;">
                  {{ isDeletingRemark ? '...' : 'ลบ' }}
                </button>
              </div>
            </div>
          </template>
        </div>

      </div>
    </div>

    </template>
    <template v-else>

      <!-- Recheck scan input -->
      <div class="card">
        <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">ยิง Recheck</p>
        <input
          ref="recheckInputRef"
          v-model="recheckBarcode"
          type="text"
          class="input w-full text-sm font-mono py-2"
          placeholder="ยิงบาร์โค้ดแล้วกด Enter... (CN.STATION_ID)"
          :disabled="!authStore.hasCNGroup || recheckStore.isScanning"
          autocomplete="off"
          @keyup.enter="runRecheckScan"
        />
        <p v-if="!authStore.hasCNGroup" class="text-[11px] mt-1.5" style="color:#92400e;">กรุณาเลือก CNGroup ก่อน</p>
      </div>

      <!-- Recheck summary -->
      <div class="card">
        <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">สรุป CNGroup นี้</p>
        <div v-if="recheckStore.isLoadingSummary" class="grid grid-cols-3 gap-2">
          <div v-for="n in 3" :key="n" class="h-12 bg-zinc-100 animate-pulse rounded-xl"></div>
        </div>
        <div v-else class="grid grid-cols-3 gap-2">
          <div class="px-3 py-2.5 rounded-xl" style="background:#eef2ff; border:1px solid #c7d2fe;">
            <p class="text-[10px] font-medium" style="color:#4338ca;">ทั้งหมด</p>
            <p class="text-lg font-bold" style="color:#4338ca;">{{ recheckStore.summary.totalPatients }}</p>
          </div>
          <div class="px-3 py-2.5 rounded-xl" style="background:#fffbeb; border:1px solid #fde68a;">
            <p class="text-[10px] font-medium" style="color:#92400e;">รอเช็ค</p>
            <p class="text-lg font-bold" style="color:#92400e;">{{ recheckStore.summary.awaitingReceiveCount }}</p>
          </div>
          <div class="px-3 py-2.5 rounded-xl" style="background:#f0fdf4; border:1px solid #bbf7d0;">
            <p class="text-[10px] font-medium" style="color:#15803d;">Lab รับแล้ว</p>
            <p class="text-lg font-bold" style="color:#15803d;">{{ recheckStore.summary.receivedCount }}</p>
          </div>
        </div>
        <div v-if="recheckStore.summary.stations?.length" class="mt-2 space-y-1 max-h-40 overflow-y-auto">
          <div v-for="st in recheckStore.summary.stations" :key="st.stationId"
            class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs"
            style="background:#fafafa; border:1px solid rgba(9,9,11,0.06);">
            <span class="text-zinc-600 truncate">{{ st.stationName }}</span>
            <span class="font-semibold shrink-0 ml-2" :style="st.awaitingReceive === 0 ? 'color:#15803d;' : 'color:#92400e;'">
              {{ st.awaitingReceive === 0 ? 'ครบ' : `รอ ${st.awaitingReceive}` }} / {{ st.total }}
            </span>
          </div>
        </div>
      </div>

      <!-- Recheck history -->
      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
            ประวัติ Recheck
            <span v-if="recheckStore.history.length" class="normal-case text-zinc-300 ml-0.5">· {{ recheckStore.history.length }}</span>
          </p>
          <button v-if="recheckStore.history.length" @click="recheckStore.clearHistory()"
            class="text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors">ล้าง</button>
        </div>

        <div v-if="!recheckStore.recentHistory.length" class="text-xs text-zinc-400 py-1">ยังไม่มีการยิงบาร์โค้ด</div>
        <div v-else class="space-y-1.5 max-h-72 overflow-y-auto">
          <div v-for="(entry, i) in recheckStore.recentHistory" :key="i"
            class="flex items-start gap-2 px-2.5 py-2 rounded-xl transition-all"
            :class="entry.status === 'cancelled' ? 'opacity-50' : ''"
            style="background:#fafafa; border:1px solid rgba(9,9,11,0.06);">
            <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold"
              :style="entry.status === 'ok' ? 'background:#dcfce7;color:#15803d;'
                : entry.status === 'duplicate' ? 'background:#fef3c7;color:#92400e;'
                : entry.status === 'cancelled' ? 'background:#f4f4f5;color:#71717a;'
                : 'background:#fee2e2;color:#b91c1c;'">
              {{ entry.status === 'ok' ? 'สำเร็จ' : entry.status === 'duplicate' ? 'ซ้ำ' : entry.status === 'cancelled' ? 'ยกเลิก' : 'ผิดพลาด' }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium truncate" :class="entry.status === 'cancelled' ? 'line-through text-zinc-400' : 'text-[#09090b]'">
                {{ entry.name || entry.barcode || '-' }}
              </p>
              <div class="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span v-if="entry.barcode" class="font-mono">{{ entry.barcode }}</span>
                <span v-if="entry.station">· {{ entry.station }}</span>
                <span>· {{ entry.time }}</span>
              </div>
              <p v-if="entry.message && entry.status === 'error'" class="text-[10px] mt-0.5" style="color:#b91c1c;">{{ entry.message }}</p>
            </div>
            <button v-if="(entry.status === 'ok' || entry.status === 'duplicate') && entry.scanItemId"
              @click="handleCancelRecheckEntry(entry)"
              class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style="color:#ef4444; border:1px solid #fecaca;">ยกเลิก</button>
          </div>
        </div>
      </div>

      <!-- Log Panel (recheck mode) -->
      <div class="card">
        <div class="flex items-center justify-between cursor-pointer select-none" @click="showLogs = !showLogs">
          <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            logs
            <span v-if="logStore.entries.length" class="normal-case font-normal text-zinc-300">· {{ logStore.entries.length }}</span>
            <span v-if="logStore.errorCount"
              class="px-1.5 py-0.5 rounded text-[9px] font-bold"
              style="background:#fff5f5; color:#FF5151; border:1px solid #fecaca;">
              {{ logStore.errorCount }} err
            </span>
          </p>
          <div class="flex items-center gap-2">
            <button v-if="logStore.entries.length && showLogs" @click.stop="logStore.clear()"
              class="text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors">ล้าง</button>
            <svg class="w-3.5 h-3.5 text-zinc-300 transition-transform duration-200"
              :class="showLogs ? 'rotate-180' : ''"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>

        <div v-if="showLogs" class="mt-2 max-h-52 overflow-y-auto space-y-0">
          <div v-if="!logStore.entries.length" class="text-xs text-zinc-400 py-0.5">ไม่มี logs</div>
          <div v-for="entry in logStore.entries" :key="entry.id"
            class="py-1.5 border-b border-zinc-50 last:border-0">
            <div class="flex items-start gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full shrink-0 mt-1" :style="logDotColor(entry.level)"></span>
              <span class="text-[10px] text-zinc-400 shrink-0 tabular-nums font-mono">{{ formatLogTime(entry.time) }}</span>
              <span class="text-[11px] flex-1 min-w-0 break-all leading-snug" :style="logTextColor(entry.level)">{{ entry.message }}</span>
            </div>
            <div v-if="entry.detail"
              class="ml-3.5 mt-0.5 text-[10px] text-zinc-400 break-all leading-tight font-mono whitespace-pre-wrap">{{ entry.detail }}</div>
          </div>
        </div>
      </div>

    </template>

    </template>

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useScannerStore } from '../stores/scanner'
import { useLogStore } from '../stores/log'
import { useRecheckStore } from '../stores/recheck'

const authStore = useAuthStore()
const scannerStore = useScannerStore()
const logStore = useLogStore()
const recheckStore = useRecheckStore()

const recheckBarcode = ref('')
const recheckInputRef = ref(null)

async function runRecheckScan() {
  if (!recheckBarcode.value || recheckStore.isScanning) return
  recheckStore.isScanning = true
  try {
    await window.api.testScan(recheckBarcode.value)
  } finally {
    recheckBarcode.value = ''
    recheckStore.isScanning = false
    nextTick(() => recheckInputRef.value?.focus())
  }
}

async function handleCancelRecheckEntry(entry) {
  const { default: Swal } = await import('sweetalert2')
  const confirm = await Swal.fire({
    title: 'ยืนยันการยกเลิก recheck',
    html: `${entry.name || entry.barcode || ''}`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยกเลิก recheck',
    cancelButtonText: 'ปิด',
    confirmButtonColor: '#FF5151',
    customClass: { popup: 'swal-app' }
  })
  if (!confirm.isConfirmed) return

  const result = await recheckStore.cancelRecheckEntry(entry)
  if (!result?.success) {
    Swal.fire({ icon: 'error', title: 'ยกเลิกไม่สำเร็จ', text: result?.message, customClass: { popup: 'swal-app' } })
  }
}

async function confirmChangeWorkflowMode() {
  const { default: Swal } = await import('sweetalert2')
  const confirm = await Swal.fire({
    icon: 'warning',
    title: 'เปลี่ยนโหมดการทำงาน?',
    text: 'จะล้างจุดตรวจและ CNGroup ที่เลือกไว้ทั้งหมด ต้องเลือกใหม่หลังเปลี่ยน',
    showCancelButton: true,
    confirmButtonText: 'เปลี่ยนโหมด',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#696CFF',
    customClass: { popup: 'swal-app' }
  })
  if (confirm.isConfirmed) {
    await authStore.resetWorkflowMode()
  }
}

// ไม่พบ ScanItem จากหน้างาน — ถามยืนยันก่อนว่าจะให้ Lab สร้างเองไหม
watch(() => recheckStore.pendingNotFound, async (data) => {
  if (!data) return
  const { default: Swal } = await import('sweetalert2')
  const name = data.patient
    ? `${data.patient.prefix || ''}${data.patient.first_name} ${data.patient.last_name}`
    : data.barcode
  const confirm = await Swal.fire({
    icon: 'warning',
    title: 'ไม่พบการยิงจากหน้างาน',
    html: `<b>${name}</b> ยังไม่มี ScanItem ที่จุด <b>${data.station?.name || ''}</b><br>` +
      `<span style="font-size:0.8em;color:#71717a;">สร้าง ScanItem โดย Lab จะถูกบันทึกว่าสร้างโดย Lab และต้องตรวจสอบย้อนหลัง</span>`,
    showCancelButton: true,
    confirmButtonText: 'สร้างโดย Lab',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#FFAB00',
    customClass: { popup: 'swal-app' }
  })
  if (confirm.isConfirmed) {
    await recheckStore.confirmLabCreate()
  } else {
    recheckStore.cancelPendingNotFound()
  }
})

// โหลด/รีเซ็ต summary ตอนเปลี่ยน CNGroup (เฉพาะ recheck mode)
watch(() => authStore.selectedCNGroup?.id, (id) => {
  if (!authStore.isRecheckMode) return
  if (id) {
    recheckStore.loadSummary(id)
  } else {
    recheckStore.resetSummary()
  }
})

const isReady = computed(() =>
  authStore.isRecheckMode
    ? authStore.hasCNGroup
    : (authStore.scanInputMode === 'auto' || authStore.hasStations) && authStore.hasCNGroup
)

const showStationSelect = ref(false)
const showCNGroupSelect = ref(false)
const showLogs = ref(false)

const cnGroups = ref([])
const isLoadingCNGroups = ref(false)
const cnGroupSearch = ref('')
let cnGroupSearchTimer = null

function cnGroupName(g) {
  const name = g.name || cnGroups.value.find(c => c.id === g.id)?.name || 'ไม่ทราบชื่อ'
  const code = g.code || cnGroups.value.find(c => c.id === g.id)?.code
  return code ? `${name} (${code})` : name
}

async function loadCNGroups(search = '') {
  isLoadingCNGroups.value = true
  try {
    const result = await window.api.getCNGroups(search)
    if (result.success) {
      cnGroups.value = result.data
      if (authStore.selectedCNGroup && !authStore.selectedCNGroup.name) {
        const found = result.data.find(g => g.id === authStore.selectedCNGroup.id)
        if (found) {
          authStore.selectedCNGroup.name = found.name
          authStore.selectedCNGroup.code = found.code
        }
      }
    }
  } catch (e) {
    console.error('Failed to load cngroups:', e)
  } finally {
    isLoadingCNGroups.value = false
  }
}

function onCNGroupSearch() {
  clearTimeout(cnGroupSearchTimer)
  cnGroupSearchTimer = setTimeout(() => loadCNGroups(cnGroupSearch.value), 300)
}

function toggleCNGroupPanel() {
  showCNGroupSelect.value = !showCNGroupSelect.value
  if (showCNGroupSelect.value && cnGroups.value.length === 0) loadCNGroups()
}

async function selectCNGroup(group) {
  await authStore.selectCNGroup(group)
  showCNGroupSelect.value = false
}

// Remark form
const remarkForm = reactive({ cn: '', stationId: '', reasonId: '', remark: '' })
const foundPatient = ref(null)
const remarkReasons = ref([])
const isLookingUp = ref(false)
const isSavingRemark = ref(false)
const isDeletingRemark = ref(false)

const stations = ref([])
const isLoadingStations = ref(false)
const stationSearch = ref('')
let searchTimer = null
const testBarcode = ref('')
const isTestLoading = ref(false)

async function runTestScan() {
  if (!testBarcode.value || isTestLoading.value) return
  isTestLoading.value = true
  try {
    await window.api.testScan(testBarcode.value)
    testBarcode.value = ''
  } finally {
    isTestLoading.value = false
  }
}

function stationName(s) {
  if (s.name) return s.name
  const found = stations.value.find(st => st.id === s.id)
  return found ? found.name : `#${s.id}`
}

async function loadStations(search = '') {
  isLoadingStations.value = true
  try {
    const result = await window.api.getStations(search)
    if (result.success) {
      stations.value = result.data
      authStore.selectedStations.forEach(sel => {
        if (!sel.name) {
          const found = result.data.find(s => s.id === sel.id)
          if (found) sel.name = found.name
        }
      })
    }
  } catch (e) {
    console.error('Failed to load stations:', e)
  } finally {
    isLoadingStations.value = false
  }
}

function onStationSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadStations(stationSearch.value), 300)
}

function toggleStationPanel() {
  showStationSelect.value = !showStationSelect.value
  if (showStationSelect.value && stations.value.length === 0) loadStations()
}

async function lookupPatient() {
  if (!remarkForm.cn || isLookingUp.value) return
  const parts = remarkForm.cn.trim().split('.')
  const stationId = parseInt(parts[parts.length - 1])
  const cn = parts.slice(0, -1).join('.')
  if (!cn || isNaN(stationId)) {
    const { default: Swal } = await import('sweetalert2')
    Swal.fire({ icon: 'warning', title: 'รูปแบบไม่ถูกต้อง', text: 'กรุณาพิมพ์ในรูปแบบ CN.จุดตรวจ เช่น 691220014.16', customClass: { popup: 'swal-app' } })
    return
  }
  isLookingUp.value = true
  foundPatient.value = null
  try {
    const result = await window.api.lookupPatient(cn, stationId)
    if (result.success) {
      foundPatient.value = result.data
      if (!remarkReasons.value.length) {
        const r = await window.api.getRemarkReasons()
        if (r.success) remarkReasons.value = r.data
      }
      const ex = result.data.existingRemark
      remarkForm.reasonId = ex?.reasonId || ''
      remarkForm.remark = ex?.remark || ''
      if (ex) {
        const { default: Swal } = await import('sweetalert2')
        await Swal.fire({
          icon: 'info',
          title: 'มีหมายเหตุอยู่แล้ว',
          html: `${ex.reasonTitle ? `<div class="text-sm text-zinc-500 mb-1">เหตุผล: <b>${ex.reasonTitle}</b></div>` : ''}${ex.remark ? `<div class="text-sm">"${ex.remark}"</div>` : '<div class="text-sm text-zinc-400">ไม่มีข้อความหมายเหตุ</div>'}`,
          confirmButtonText: 'แก้ไขหมายเหตุ',
          confirmButtonColor: '#696CFF',
          customClass: { popup: 'swal-app' }
        })
      }
    } else {
      import('sweetalert2').then(({ default: Swal }) => {
        Swal.fire({ icon: 'warning', title: 'ไม่พบผู้ป่วย', text: result.message, customClass: { popup: 'swal-app' } })
      })
    }
  } finally {
    isLookingUp.value = false
  }
}

async function deleteRemark() {
  if (!foundPatient.value || isDeletingRemark.value) return
  const { default: Swal } = await import('sweetalert2')
  const confirmed = await Swal.fire({
    title: 'ยืนยันการลบหมายเหตุ',
    text: `ลบหมายเหตุของ ${foundPatient.value.name} ที่จุดตรวจ ${foundPatient.value.station?.name}`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ef4444',
    customClass: { popup: 'swal-app' }
  })
  if (!confirmed.isConfirmed) return
  isDeletingRemark.value = true
  try {
    const result = await window.api.deleteStationRemark(
      foundPatient.value.patientCNGroupId,
      foundPatient.value.station.id,
      foundPatient.value.cnGroupId || null
    )
    if (result.success !== false) {
      remarkForm.cn = ''
      remarkForm.reasonId = ''
      remarkForm.remark = ''
      foundPatient.value = null
      Swal.fire({ icon: 'success', title: 'ลบหมายเหตุสำเร็จ', timer: 2000, showConfirmButton: false, customClass: { popup: 'swal-app' } })
    } else {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: result.message, customClass: { popup: 'swal-app' } })
    }
  } finally {
    isDeletingRemark.value = false
  }
}

async function submitRemark() {
  if (!foundPatient.value || isSavingRemark.value) return
  isSavingRemark.value = true
  try {
    const result = await window.api.createStationRemark({
      patientCNGroupId: foundPatient.value.patientCNGroupId,
      stationId: foundPatient.value.station.id,
      reasonId: remarkForm.reasonId || null,
      remark: remarkForm.remark || null,
      cnGroupId: foundPatient.value.cnGroupId || null
    })
    if (result.success) {
      // อัพเดท existingRemark ให้แสดงปุ่มลบได้ทันที ไม่ต้อง lookup ใหม่
      foundPatient.value = {
        ...foundPatient.value,
        existingRemark: {
          reasonId: remarkForm.reasonId || null,
          remark: remarkForm.remark || null
        }
      }
      import('sweetalert2').then(({ default: Swal }) => {
        Swal.fire({ icon: 'success', title: 'บันทึกหมายเหตุสำเร็จ', timer: 2000, showConfirmButton: false, customClass: { popup: 'swal-app' } })
      })
    } else {
      import('sweetalert2').then(({ default: Swal }) => {
        Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: result.message, customClass: { popup: 'swal-app' } })
      })
    }
  } finally {
    isSavingRemark.value = false
  }
}

function formatLogTime(t) {
  const d = t instanceof Date ? t : new Date(t)
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function logDotColor(level) {
  const map = { success: 'background:#71DD37;', error: 'background:#FF5151;', warn: 'background:#FFAB00;', info: 'background:#03C3EC;' }
  return map[level] || 'background:#d4d4d8;'
}

function logTextColor(level) {
  const map = { error: 'color:#FF5151;', warn: 'color:#92400e;' }
  return map[level] || 'color:#3f3f46;'
}

function formatTime(ts, short = false) {
  if (!ts) return ''
  const d = new Date(ts)
  if (short) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

onMounted(() => {
  scannerStore.setupIPCListeners()
  recheckStore.setupIPCListeners()
  if (authStore.selectedStations.some(s => !s.name)) loadStations()
  if (authStore.selectedCNGroup && !authStore.selectedCNGroup.name) loadCNGroups()
  if (authStore.isRecheckMode && authStore.selectedCNGroup?.id) {
    recheckStore.loadSummary(authStore.selectedCNGroup.id)
  }

  window.api.onLog((data) => {
    logStore.add(data.level, data.message, data.detail)
    if (data.level === 'error') showLogs.value = true
  })
})
</script>

<style scoped>
.animate-in {
  animation: slideIn 0.12s ease;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
