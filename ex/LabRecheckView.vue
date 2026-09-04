<template>
  <audio ref="audioSuccess" src="/sounds/1-correct-2-46134.mp3" preload="auto" />
  <audio ref="audioError" src="/sounds/2-wronganswer-37702.mp3" preload="auto" />
  <audio ref="audioDuplicate" src="/sounds/3-duplicate.mp3" preload="auto" />

  <div class="space-y-6">

    <!-- HEADER BAR -->
    <div class="bg-white rounded-lg shadow-sm border border-ui-border-default p-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">

        <!-- Mode Toggle -->
        <div class="inline-flex bg-ui-bg-secondary border border-ui-border-default rounded-lg p-0.5 flex-shrink-0">
          <button
            v-for="m in modes" :key="m.value"
            @click="switchMode(m.value)"
            :class="['px-3 py-1.5 text-sm font-semibold rounded-md transition-all',
              mode === m.value ? 'bg-brand-primary text-white shadow-sm' : 'text-ui-text-secondary hover:text-ui-text-primary']"
          >{{ m.label }}</button>
        </div>

        <!-- Checkup: CNGroup Listbox (dropdown ของหน้านี้เอง ไม่ผูกกับ Sidebar) -->
        <template v-if="mode === 'checkup'">
          <Listbox v-model="selectedCNGroup" as="div" class="relative">
            <ListboxButton class="flex items-center gap-2 px-3 py-2 bg-white hover:bg-ui-bg-secondary border border-ui-border-default rounded-lg text-left cursor-pointer transition-colors shadow-sm hover:shadow-md h-10 min-w-40">
              <span class="text-sm font-medium flex-1">
                <span v-if="selectedCNGroup" class="text-ui-text-primary">{{ selectedCNGroup.name }}</span>
                <span v-else class="text-ui-text-tertiary">เลือก CNGroup</span>
              </span>
              <ChevronDown class="w-4 h-4 text-ui-text-tertiary flex-shrink-0" />
            </ListboxButton>
            <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <ListboxOptions class="absolute left-0 mt-1 z-50 p-2 shadow-xl bg-white rounded-xl border border-ui-border-default w-[28rem] max-w-[90vw] max-h-80 overflow-y-auto focus:outline-none">
                <div class="px-1 pb-2 sticky -top-2 -mt-2 pt-2 bg-white z-10">
                  <div class="relative">
                    <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-text-tertiary pointer-events-none" />
                    <input
                      v-model="cnGroupSearch"
                      @input="onCNGroupSearchInput"
                      @click.stop
                      @keydown.space.stop
                      type="text"
                      placeholder="ค้นหา CNGroup..."
                      class="w-full pl-8 pr-3 py-1.5 text-sm border border-ui-border-default rounded-lg bg-white text-ui-text-primary placeholder-ui-text-tertiary focus:border-ui-border-focus focus:ring-2 focus:ring-brand-primary-light focus:outline-none"
                    />
                  </div>
                </div>
                <div v-if="isLoadingCNGroups" class="px-3 py-4 text-center text-xs text-ui-text-tertiary">กำลังโหลด...</div>
                <div v-else-if="cnGroups.length === 0" class="px-3 py-4 text-center text-xs text-ui-text-tertiary">
                  {{ cnGroupSearch ? 'ไม่พบ CNGroup ที่ค้นหา' : 'ไม่มี CNGroup' }}
                </div>
                <ListboxOption v-else v-for="g in cnGroups" :key="g.id" :value="g" v-slot="{ active, selected }">
                  <li :class="['py-2 px-3 rounded-lg mx-1.5 mt-1 text-sm cursor-pointer flex items-start justify-between gap-2 transition-colors', active ? 'bg-brand-primary-light text-ui-text-brand-primary' : 'text-ui-text-primary hover:bg-ui-bg-secondary']">
                    <span>{{ g.name }}<span v-if="g.code" class="text-ui-text-tertiary"> · {{ g.code }}</span></span>
                    <CheckCircle v-if="selected" class="w-4 h-4 text-ui-text-brand-primary flex-shrink-0 mt-0.5" />
                  </li>
                </ListboxOption>
              </ListboxOptions>
            </transition>
          </Listbox>

          <button
            v-if="selectedCNGroupId"
            @click="exportRecheckExcel"
            :disabled="isExportingExcel"
            class="inline-flex items-center gap-1.5 px-3 py-2 h-10 text-sm font-semibold rounded-lg border border-ui-border-default bg-white text-ui-text-secondary hover:bg-ui-bg-secondary hover:text-ui-text-brand-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            v-tooltip:top="'ดาวน์โหลดรายงาน Recheck LAB เป็น Excel'"
          >
            <Download class="w-4 h-4" />
            {{ isExportingExcel ? 'กำลังสร้างไฟล์...' : 'Export Excel' }}
          </button>
        </template>

        <!-- Clinic: Branch Listbox + VueDatePicker -->
        <template v-else>
          <Listbox v-model="selectedBranch" as="div" class="relative">
            <ListboxButton class="flex items-center gap-2 px-3 py-2 bg-white hover:bg-ui-bg-secondary border border-ui-border-default rounded-lg text-left cursor-pointer transition-colors shadow-sm hover:shadow-md h-10 min-w-40">
              <span class="text-sm font-medium flex-1">
                <span v-if="selectedBranch" class="text-ui-text-primary">{{ selectedBranch.name }}</span>
                <span v-else class="text-ui-text-tertiary">ทุกสาขา</span>
              </span>
              <ChevronDown class="w-4 h-4 text-ui-text-tertiary flex-shrink-0" />
            </ListboxButton>
            <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <ListboxOptions class="absolute left-0 mt-1 z-50 p-2 shadow-xl bg-white rounded-xl border border-ui-border-default w-52 focus:outline-none">
                <ListboxOption :value="null" v-slot="{ active, selected }">
                  <li :class="['py-2 px-3 rounded-lg mx-1.5 mt-1 text-sm cursor-pointer flex items-center justify-between transition-colors', active ? 'bg-brand-primary-light text-ui-text-brand-primary' : 'text-ui-text-primary hover:bg-ui-bg-secondary']">
                    <span>ทุกสาขา</span>
                    <CheckCircle v-if="selected" class="w-4 h-4 text-ui-text-brand-primary flex-shrink-0" />
                  </li>
                </ListboxOption>
                <ListboxOption v-for="b in branches" :key="b.id" :value="b" v-slot="{ active, selected }">
                  <li :class="['py-2 px-3 rounded-lg mx-1.5 mt-1 text-sm cursor-pointer flex items-center justify-between transition-colors', active ? 'bg-brand-primary-light text-ui-text-brand-primary' : 'text-ui-text-primary hover:bg-ui-bg-secondary']">
                    <span>{{ b.name }}</span>
                    <CheckCircle v-if="selected" class="w-4 h-4 text-ui-text-brand-primary flex-shrink-0" />
                  </li>
                </ListboxOption>
              </ListboxOptions>
            </transition>
          </Listbox>

          <VueDatePicker
            v-model="selectedDate"
            :enable-time-picker="false"
            format="dd/MM/yyyy"
            locale="th"
            placeholder="เลือกวันที่"
            auto-apply
            input-class-name="w-full px-3 py-2 text-sm border border-ui-border-default rounded-lg shadow-sm bg-white text-ui-text-primary placeholder-ui-text-tertiary focus:border-ui-border-focus focus:ring-2 focus:ring-brand-primary-light focus:outline-none transition-all hover:shadow-md h-10"
          />
        </template>
      </div>
    </div>

    <!-- NOT READY -->
    <div v-if="!isReady" class="bg-white rounded-lg border border-dashed border-ui-border-default p-12 flex flex-col items-center text-center">
      <div class="w-12 h-12 bg-brand-primary-light rounded-lg flex items-center justify-center mx-auto mb-4">
        <FlaskConical class="w-6 h-6 text-ui-text-brand-primary" />
      </div>
      <p class="text-base font-semibold text-ui-text-primary mb-1">ยังไม่ได้เลือก CNGroup</p>
      <p class="text-sm text-ui-text-secondary">กรุณาเลือก CNGroup ด้านบนก่อนเริ่มใช้งาน</p>
    </div>

    <!-- MAIN CONTENT -->
    <div v-else class="flex flex-col md:flex-row gap-4">

      <!-- LEFT: Scan input + History -->
      <div class="w-full md:w-[45%] space-y-4">

        <!-- Scan Card -->
        <div class="bg-white rounded-lg shadow-sm border transition-all hover:shadow-md"
          :class="{
            'border-brand-success': lastStatus === 'ok',
            'border-brand-error': lastStatus === 'error',
            'border-brand-warning': lastStatus === 'duplicate',
            'border-ui-border-default': !lastStatus,
          }"
        >
          <div class="px-5 py-4 border-b border-ui-border-default">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-ui-bg-tertiary border border-ui-border-default rounded-lg flex items-center justify-center">
                <ScanLine class="text-brand-secondary w-5 h-5" />
              </div>
              <h2 class="text-base font-semibold text-ui-text-brand-primary">ยิง Recheck</h2>
              <span class="ml-auto text-xs font-mono text-ui-text-tertiary">{{ mode === 'checkup' ? 'CN.StationID' : 'HN.StationID' }}</span>
            </div>
          </div>
          <div class="p-4 space-y-3">
            <input
              ref="barcodeInput"
              v-model="barcodeValue"
              type="text"
              placeholder="ยิงบาร์โค้ดแล้วกด Enter..."
              class="w-full px-4 py-2.5 text-sm border border-ui-border-default rounded-lg shadow-sm bg-white font-mono placeholder-ui-text-tertiary focus:border-ui-border-focus focus:ring-2 focus:ring-brand-primary-light focus:outline-none transition-all hover:shadow-md"
              @keyup.enter="handleRecheck"
              autocomplete="off"
            />
            <div class="flex items-center justify-between">
              <span class="text-xs text-ui-text-secondary">
                session นี้ recheck แล้ว
                <span class="font-semibold text-ui-text-brand-primary">{{ sessionCount }}</span> ครั้ง
              </span>
              <button @click="clearHistory" class="text-xs text-ui-text-tertiary hover:text-ui-text-brand-error transition-colors focus:outline-none">
                ล้าง history
              </button>
            </div>
          </div>
        </div>

        <!-- History Card -->
        <div class="bg-white rounded-lg shadow-sm border border-ui-border-default overflow-hidden">
          <div class="px-4 py-3 border-b border-ui-border-default flex items-center gap-2">
            <ClockIcon class="w-4 h-4 text-ui-text-tertiary" />
            <span class="text-sm font-semibold text-ui-text-primary">ประวัติการ Recheck</span>
          </div>
          <div v-if="history.length === 0" class="py-10 text-center text-sm text-ui-text-tertiary">
            ยังไม่มีการยิงบาร์โค้ด
          </div>
          <ul v-else class="divide-y divide-ui-border-default max-h-[400px] overflow-y-auto">
            <li
              v-for="(entry, i) in history" :key="i"
              class="px-4 py-3 hover:bg-ui-bg-secondary transition-colors"
              :class="{ 'opacity-50': entry.status === 'cancelled' }"
            >
              <div class="flex items-start gap-3">
                <!-- Status badge -->
                <div class="mt-0.5 flex-shrink-0">
                  <span :class="[
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold',
                    entry.status === 'ok'
                      ? 'bg-brand-success-light text-ui-text-brand-success border border-brand-success/20'
                      : entry.status === 'duplicate'
                      ? 'bg-brand-accent-light text-ui-text-brand-accent border border-brand-accent/20'
                      : entry.status === 'cancelled'
                      ? 'bg-ui-bg-tertiary text-ui-text-tertiary border border-ui-border-default'
                      : 'bg-brand-error-light text-ui-text-brand-error border border-brand-error/20'
                  ]">
                    <div class="w-1.5 h-1.5 rounded-full" :class="{
                      'bg-brand-success': entry.status === 'ok',
                      'bg-brand-accent': entry.status === 'duplicate',
                      'bg-ui-text-tertiary': entry.status === 'cancelled',
                      'bg-brand-error': entry.status === 'error',
                    }" />
                    {{ entry.status === 'ok' ? 'สำเร็จ'
                      : entry.status === 'duplicate' ? 'ซ้ำ'
                      : entry.status === 'cancelled' ? 'ยกเลิก'
                      : 'ผิดพลาด' }}
                  </span>
                </div>
                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p v-if="entry.name" class="text-sm font-medium text-ui-text-primary truncate">{{ entry.name }}</p>
                  <p v-else class="text-sm text-ui-text-secondary">{{ entry.barcode }}</p>
                  <div class="flex items-center gap-2 mt-0.5 text-xs text-ui-text-tertiary">
                    <span class="font-mono">{{ entry.barcode }}</span>
                    <span v-if="entry.station">· {{ entry.station }}</span>
                  </div>
                  <p v-if="entry.status === 'error' && entry.message" class="mt-0.5 text-xs text-ui-text-brand-error">{{ entry.message }}</p>
                </div>
                <!-- Time + cancel -->
                <div class="flex flex-col items-end gap-1 flex-shrink-0">
                  <span class="text-xs text-ui-text-tertiary">{{ entry.time }}</span>
                  <button
                    v-if="entry.status === 'ok' || entry.status === 'duplicate'"
                    @click="cancelRecheck(entry)"
                    class="text-[10px] font-semibold px-2 py-0.5 rounded border border-brand-error/30 text-ui-text-brand-error bg-brand-error-light hover:bg-brand-error hover:text-white transition-all focus:outline-none"
                  >ยกเลิก</button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- RIGHT: Summary -->
      <div class="flex-1 min-w-0 space-y-4">

        <!-- Stat Cards (compact — same as scan views) -->
        <template v-if="isLoadingSummary">
          <div class="grid grid-cols-4 gap-2">
            <div v-for="n in 4" :key="n" class="h-12 bg-ui-bg-tertiary animate-pulse rounded-lg" />
          </div>
        </template>
        <div v-else class="grid grid-cols-4 gap-2">
          <div
            :class="['flex flex-col gap-0.5 px-3 py-2 bg-brand-secondary-light border rounded-lg transition-all',
              isKeyUpdated('total') ? 'animate-pulse-update ring-2 ring-brand-secondary shadow-md scale-105 border-brand-secondary' : 'border-brand-secondary/20 shadow-sm']"
          >
            <span class="text-xs font-medium text-ui-text-brand-secondary">ทั้งหมด</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ui-text-brand-secondary">{{ summary.totalSamples }}</span>
              <span class="text-[10px] text-ui-text-brand-secondary/70">ตัวอย่าง</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-sm font-bold text-ui-text-brand-secondary">{{ summary.totalPatients }}</span>
              <span class="text-[10px] text-ui-text-brand-secondary/70">คน</span>
            </div>
          </div>
          <div
            :class="['flex flex-col gap-0.5 px-3 py-2 bg-brand-warning-light border rounded-lg transition-all',
              isKeyUpdated('awaiting') ? 'animate-pulse-update ring-2 ring-brand-warning shadow-md scale-105 border-brand-warning' : 'border-brand-warning/20 shadow-sm']"
          >
            <span class="text-xs font-medium text-ui-text-brand-warning">รอเช็ค</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ui-text-brand-warning">{{ summary.awaitingReceiveCount }}</span>
              <span class="text-[10px] text-ui-text-brand-warning/70">ตัวอย่าง</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-sm font-bold text-ui-text-brand-warning">{{ summary.awaitingReceivePatientCount }}</span>
              <span class="text-[10px] text-ui-text-brand-warning/70">คน</span>
            </div>
          </div>
          <div
            :class="['flex flex-col gap-0.5 px-3 py-2 bg-brand-success-light border rounded-lg transition-all',
              isKeyUpdated('received') ? 'animate-pulse-update ring-2 ring-brand-success shadow-md scale-105 border-brand-success' : 'border-brand-success/20 shadow-sm']"
          >
            <span class="text-xs font-medium text-ui-text-brand-success">Lab รับแล้ว</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ui-text-brand-success">{{ summary.receivedCount }}</span>
              <span class="text-[10px] text-ui-text-brand-success/70">ตัวอย่าง</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-sm font-bold text-ui-text-brand-success">{{ summary.receivedPatientCount }}</span>
              <span class="text-[10px] text-ui-text-brand-success/70">คน</span>
            </div>
          </div>
          <button
            type="button"
            @click="openExceptionsModal"
            :class="['flex flex-col gap-0.5 px-3 py-2 bg-brand-error-light border rounded-lg text-left hover:shadow-md transition-all focus:outline-none',
              isKeyUpdated('exceptions') ? 'animate-pulse-update ring-2 ring-brand-error shadow-md scale-105 border-brand-error' : 'border-brand-error/20 shadow-sm']"
          >
            <span class="text-xs font-medium text-ui-text-brand-error">รอตรวจสอบ</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ui-text-brand-error">{{ exceptionPendingCount }}</span>
              <span class="text-[10px] text-ui-text-brand-error/70">รายการ</span>
            </div>
            <span class="text-[10px] text-ui-text-brand-error/70">กดดูรายละเอียด</span>
          </button>
        </div>

        <!-- Station Cards -->
        <div v-if="isLoadingSummary" class="grid grid-cols-2 gap-2">
          <div v-for="n in 4" :key="n" class="h-16 bg-ui-bg-tertiary animate-pulse rounded-lg" />
        </div>
        <div v-else-if="summary.stations?.length" class="grid grid-cols-2 gap-2">
          <button
            v-for="st in summary.stations" :key="st.stationId"
            @click="openDrilldown(st)"
            class="bg-white rounded-lg border text-left focus:outline-none transition-all"
            :class="isKeyUpdated(`station-${st.stationId}`)
              ? 'animate-pulse-update ring-2 ring-brand-primary shadow-md scale-105 border-brand-primary'
              : (st.awaitingReceive === 0 ? 'border-brand-success/30 hover:border-brand-success/60 shadow-sm hover:shadow-md' : 'border-ui-border-default hover:border-brand-primary/30 shadow-sm hover:shadow-md')"
          >
            <div class="px-3 py-2.5">
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-[10px] font-mono font-bold text-ui-text-brand-primary flex-shrink-0">#{{ st.stationId }}</span>
                  <p class="text-xs font-semibold text-ui-text-primary truncate">{{ st.stationName }}</p>
                </div>
                <span :class="[
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold flex-shrink-0',
                  st.awaitingReceive === 0
                    ? 'bg-brand-success-light text-ui-text-brand-success border border-brand-success/20'
                    : 'bg-brand-warning-light text-ui-text-brand-warning border border-brand-warning/20'
                ]">
                  <div :class="['w-1.5 h-1.5 rounded-full', st.awaitingReceive === 0 ? 'bg-brand-success' : 'bg-brand-warning']" />
                  {{ st.awaitingReceive === 0 ? 'ครบ' : `รอเช็ค ${st.awaitingReceive}` }}
                </span>
              </div>
              <div class="flex items-center justify-between text-xs text-ui-text-secondary">
                <span>รับแล้ว <span class="font-semibold text-ui-text-brand-success">{{ st.received }}</span></span>
                <span>ทั้งหมด <span class="font-semibold text-ui-text-primary">{{ st.total }}</span></span>
              </div>
            </div>
          </button>
        </div>

      </div>
    </div>

    <!-- DRILLDOWN MODAL -->
    <TransitionRoot appear :show="!!drilldown" as="template">
      <HeadlessDialog as="div" class="relative z-50" @close="closeDrilldown">
        <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-black/30 transition-opacity" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="ease-in duration-200" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
              <DialogPanel class="w-full max-w-[90vw] max-h-[90vh] transform rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-ui-border-default flex flex-col overflow-hidden">

                <!-- Header -->
                <div class="px-6 pt-5 pb-4 border-b border-ui-border-default bg-white/95 flex-shrink-0">
                  <div class="flex items-center justify-between mb-3">
                    <DialogTitle class="text-lg font-bold text-ui-text-brand-primary">
                      {{ drilldown?.stationName }}
                    </DialogTitle>
                    <button @click="closeDrilldown" class="text-ui-text-tertiary hover:text-ui-text-brand-error bg-ui-bg-secondary hover:bg-brand-error-light rounded-lg p-1.5 transition-all">
                      <X class="w-5 h-5" />
                    </button>
                  </div>
                  <!-- Summary badges (จาก API) -->
                  <div class="flex items-center gap-2 flex-wrap">
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-brand-info-light border border-brand-info/20 rounded-lg">
                      <span class="text-xs font-medium text-ui-text-brand-info">ทั้งหมด:</span>
                      <span class="text-sm font-bold text-ui-text-brand-info">{{ drilldownApiSummary.total || drilldown?.total || 0 }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-brand-warning-light border border-brand-warning/20 rounded-lg">
                      <span class="text-xs font-medium text-ui-text-brand-warning">รอเช็ค:</span>
                      <span class="text-sm font-bold text-ui-text-brand-warning">{{ drilldownApiSummary.awaitingReceiveCount ?? drilldown?.awaitingReceive ?? 0 }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-brand-success-light border border-brand-success/20 rounded-lg">
                      <span class="text-xs font-medium text-ui-text-brand-success">Lab รับแล้ว:</span>
                      <span class="text-sm font-bold text-ui-text-brand-success">{{ drilldownApiSummary.receivedCount ?? drilldown?.received ?? 0 }}</span>
                    </div>
                  </div>
                </div>

                <!-- Search + filter row -->
                <div class="px-6 py-3 border-b border-ui-border-default bg-ui-bg-secondary flex-shrink-0">
                  <div class="flex items-center gap-3 flex-wrap">
                    <div class="relative flex-1 min-w-[200px]">
                      <SearchIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ui-text-tertiary" />
                      <input
                        v-model="drilldownSearch"
                        @input="onDrilldownSearchInput"
                        type="text"
                        placeholder="ค้นหาชื่อ, CN, บริษัท..."
                        class="w-full pl-10 pr-4 py-2.5 text-sm border border-ui-border-default rounded-lg shadow-sm bg-white text-ui-text-primary placeholder-ui-text-tertiary focus:border-ui-border-focus focus:ring-2 focus:ring-brand-primary-light focus:outline-none transition-all hover:shadow-md"
                      />
                    </div>
                    <div class="inline-flex bg-ui-bg-secondary border border-ui-border-default rounded-lg p-0.5">
                      <button
                        v-for="opt in drilldownStatusOptions" :key="opt.value"
                        @click="drilldownScanStatus = opt.value"
                        :class="['px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                          drilldownScanStatus === opt.value ? 'bg-brand-primary text-white shadow-sm' : 'text-ui-text-secondary hover:text-ui-text-primary']"
                      >{{ opt.label }}</button>
                    </div>
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-y-auto min-h-0">

                  <!-- Loading -->
                  <div v-if="drilldownLoading" class="p-4 space-y-2">
                    <div v-for="n in 6" :key="n" class="h-10 bg-ui-bg-tertiary animate-pulse rounded-lg" />
                  </div>

                  <!-- Empty -->
                  <div v-else-if="drilldownPatients.length === 0" class="py-10 flex flex-col items-center text-center">
                    <div class="w-10 h-10 bg-brand-success-light rounded-lg flex items-center justify-center mx-auto mb-3">
                      <CheckCircle class="w-5 h-5 text-ui-text-brand-success" />
                    </div>
                    <p class="text-sm font-semibold text-ui-text-primary">
                      {{ drilldownSearch ? 'ไม่พบข้อมูล' : (drilldownScanStatus === 'awaitingReceive' ? 'เช็คครบทุกรายแล้ว' : 'ยังไม่มีรายการ') }}
                    </p>
                  </div>

                  <!-- Table -->
                  <div v-else class="p-4">
                    <div class="rounded-lg border border-ui-border-default bg-white/95 overflow-x-auto">
                      <table class="min-w-full divide-y divide-ui-border-default">
                        <thead>
                          <tr class="border-b-2 border-brand-primary/20 bg-brand-primary-light/30">
                            <th class="px-4 py-3 text-left text-sm font-bold text-ui-text-brand-primary whitespace-nowrap">CN</th>
                            <th class="px-4 py-3 text-left text-sm font-bold text-ui-text-brand-primary">ชื่อ-นามสกุล</th>
                            <th class="px-4 py-3 text-left text-sm font-bold text-ui-text-brand-primary whitespace-nowrap">รหัสพนักงาน</th>
                            <th class="px-4 py-3 text-left text-sm font-bold text-ui-text-brand-primary">บริษัท</th>
                            <th class="px-4 py-3 text-left text-sm font-bold text-ui-text-brand-primary">แผนก</th>
                            <th class="px-4 py-3 text-left text-sm font-bold text-ui-text-brand-primary">ตำแหน่ง</th>
                            <th class="px-4 py-3 text-left text-sm font-bold text-ui-text-brand-primary whitespace-nowrap">วันที่ลงทะเบียน</th>
                            <th v-if="drilldownScanStatus === 'all'" class="px-4 py-3 text-left text-sm font-bold text-ui-text-brand-primary whitespace-nowrap">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-ui-border-default">
                          <tr v-for="p in drilldownPatients" :key="p.patientId" class="hover:bg-ui-bg-secondary transition-colors">
                            <td class="px-4 py-3 whitespace-nowrap text-sm align-top">
                              <span class="inline-flex items-center px-2.5 py-1 rounded-lg bg-brand-secondary-light text-ui-text-brand-secondary text-xs font-semibold border border-brand-secondary/20">
                                {{ p.cn || p.hn || '-' }}
                              </span>
                            </td>
                            <td class="px-4 py-3 text-sm font-medium text-ui-text-primary align-top whitespace-nowrap">{{ p.name || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ui-text-secondary align-top whitespace-nowrap">{{ p.employeeCode || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ui-text-secondary align-top">{{ p.companyName || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ui-text-secondary align-top whitespace-nowrap">{{ p.department || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ui-text-secondary align-top whitespace-nowrap">{{ p.position || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ui-text-secondary align-top whitespace-nowrap">{{ formatDate(p.registeredAt) }}</td>
                            <td v-if="drilldownScanStatus === 'all'" class="px-4 py-3 align-top whitespace-nowrap">
                              <span :class="[
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold',
                                p.status === 'received'
                                  ? 'bg-brand-success-light text-ui-text-brand-success border border-brand-success/20'
                                  : 'bg-brand-warning-light text-ui-text-brand-warning border border-brand-warning/20'
                              ]">
                                <div :class="['w-1.5 h-1.5 rounded-full', p.status === 'received' ? 'bg-brand-success' : 'bg-brand-warning']" />
                                {{ p.status === 'received' ? 'Lab รับแล้ว' : 'รอเช็ค' }}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- Pagination footer -->
                <div v-if="drilldownPagination.totalPages > 1" class="flex flex-col sm:flex-row rounded-b-2xl items-center justify-between px-4 py-3 bg-ui-bg-secondary border-t border-ui-border-default text-sm gap-3 flex-shrink-0">
                  <div class="text-ui-text-secondary text-xs">
                    แสดง <span class="font-semibold text-ui-text-primary">{{ (drilldownPagination.page - 1) * drilldownPagination.limit + 1 }}</span>
                    - <span class="font-semibold text-ui-text-primary">{{ Math.min(drilldownPagination.page * drilldownPagination.limit, drilldownPagination.total) }}</span>
                    จากทั้งหมด <span class="font-semibold text-ui-text-primary">{{ drilldownPagination.total }}</span> รายการ
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-ui-border-default rounded-lg bg-white text-ui-text-primary hover:bg-ui-bg-secondary transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      :disabled="drilldownPagination.page <= 1 || drilldownLoading"
                      @click="drilldownPageChange(drilldownPagination.page - 1)"
                    >
                      <ChevronLeft class="w-3.5 h-3.5" /> ก่อนหน้า
                    </button>
                    <span class="px-3 py-1.5 text-xs bg-white border border-ui-border-default rounded-lg text-ui-text-primary shadow-sm">
                      หน้า <span class="text-ui-text-brand-primary font-semibold">{{ drilldownPagination.page }}</span> / {{ drilldownPagination.totalPages }}
                    </span>
                    <button
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-ui-border-default rounded-lg bg-white text-ui-text-primary hover:bg-ui-bg-secondary transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      :disabled="drilldownPagination.page >= drilldownPagination.totalPages || drilldownLoading"
                      @click="drilldownPageChange(drilldownPagination.page + 1)"
                    >
                      ถัดไป <ChevronRight class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </HeadlessDialog>
    </TransitionRoot>

    <!-- EXCEPTIONS MODAL -->
    <TransitionRoot appear :show="showExceptionsModal" as="template">
      <HeadlessDialog as="div" class="relative z-50" @close="closeExceptionsModal">
        <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-black/30 transition-opacity" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="ease-in duration-200" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
              <DialogPanel class="w-full max-w-2xl max-h-[85vh] transform rounded-2xl bg-white shadow-xl border border-ui-border-default flex flex-col overflow-hidden">
                <div class="px-6 pt-5 pb-4 border-b border-ui-border-default flex-shrink-0">
                  <div class="flex items-center justify-between mb-3">
                    <DialogTitle class="text-lg font-bold text-ui-text-brand-error">รายการผิดปกติ — รอตรวจสอบ</DialogTitle>
                    <button @click="closeExceptionsModal" class="text-ui-text-tertiary hover:text-ui-text-brand-error bg-ui-bg-secondary hover:bg-brand-error-light rounded-lg p-1.5 transition-all">
                      <X class="w-5 h-5" />
                    </button>
                  </div>
                  <div class="inline-flex bg-ui-bg-secondary border border-ui-border-default rounded-lg p-0.5">
                    <button
                      v-for="opt in exceptionStatusOptions" :key="opt.value"
                      @click="exceptionStatusFilter = opt.value"
                      :class="['px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                        exceptionStatusFilter === opt.value ? 'bg-brand-primary text-white shadow-sm' : 'text-ui-text-secondary hover:text-ui-text-primary']"
                    >{{ opt.label }}</button>
                  </div>
                </div>

                <div class="flex-1 overflow-y-auto min-h-0 p-4">
                  <div v-if="exceptionsLoading" class="space-y-2">
                    <div v-for="n in 4" :key="n" class="h-16 bg-ui-bg-tertiary animate-pulse rounded-lg" />
                  </div>
                  <div v-else-if="exceptions.length === 0" class="py-10 flex flex-col items-center text-center">
                    <div class="w-10 h-10 bg-brand-success-light rounded-lg flex items-center justify-center mx-auto mb-3">
                      <CheckCircle class="w-5 h-5 text-ui-text-brand-success" />
                    </div>
                    <p class="text-sm font-semibold text-ui-text-primary">ไม่มีรายการในสถานะนี้</p>
                  </div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="ex in exceptions" :key="ex.id"
                      class="border border-ui-border-default rounded-lg p-3"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-mono text-xs font-semibold text-ui-text-primary">{{ ex.barcode }}</span>
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-error-light text-ui-text-brand-error border border-brand-error/20">
                              {{ ex.reason === 'CN_NOT_FOUND' ? 'ไม่พบ CN' : 'ไม่พบการยิงจากหน้างาน' }}
                            </span>
                          </div>
                          <p class="text-xs text-ui-text-secondary mt-1">{{ ex.message }}</p>
                          <p class="text-[11px] text-ui-text-tertiary mt-1">
                            {{ ex.station?.name || '-' }} · ยิงโดย {{ ex.scannedByUser?.name || '-' }} · {{ formatDate(ex.scannedAt) }}
                          </p>
                          <p v-if="ex.status !== 'PENDING'" class="text-[11px] text-ui-text-tertiary mt-1">
                            {{ ex.status === 'RESOLVED' ? 'แก้ไขแล้ว' : 'ไม่ใช่ปัญหา' }}โดย {{ ex.resolvedByUser?.name || '-' }}
                            <span v-if="ex.resolutionNote"> — {{ ex.resolutionNote }}</span>
                          </p>
                        </div>
                        <div v-if="ex.status === 'PENDING'" class="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            @click="resolveException(ex, 'RESOLVED')"
                            class="text-[11px] font-semibold px-2.5 py-1 rounded border border-brand-success/30 text-ui-text-brand-success bg-brand-success-light hover:bg-brand-success hover:text-white transition-all focus:outline-none"
                          >แก้ไขแล้ว</button>
                          <button
                            @click="resolveException(ex, 'DISMISSED')"
                            class="text-[11px] font-semibold px-2.5 py-1 rounded border border-ui-border-default text-ui-text-tertiary bg-white hover:bg-ui-bg-secondary transition-all focus:outline-none"
                          >ไม่ใช่ปัญหา</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </HeadlessDialog>
    </TransitionRoot>

  </div>
</template>

<script>
import {
  Listbox, ListboxButton, ListboxOptions, ListboxOption,
  Dialog as HeadlessDialog, DialogPanel, DialogTitle,
  TransitionRoot, TransitionChild,
} from '@headlessui/vue'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import {
  FlaskConical, ScanLine, CheckCircle, X, Download,
  Clock as ClockIcon, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import recheckScanService from '@/services/recheckScan.service.js'
import cnGroupService from '@/services/cngroup'
import { exportRecheck } from '@/services/excel.js'
import { subscribeToRecheckUpdate } from '@/services/socket.service.js'
import Swal from 'sweetalert2'

export default {
  name: 'LabRecheckView',
  components: {
    Listbox, ListboxButton, ListboxOptions, ListboxOption,
    HeadlessDialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild,
    VueDatePicker,
    FlaskConical, ScanLine, CheckCircle, X, Download,
    ClockIcon, ChevronDown, ChevronLeft, ChevronRight, SearchIcon,
  },

  setup() {
    return {
      authStore: useAuthStore(),
    }
  },

  data() {
    return {
      modes: [{ value: 'checkup', label: 'Checkup' }, { value: 'clinic', label: 'Clinic' }],
      mode: 'checkup',
      cnGroups: [],
      selectedCNGroup: null,
      cnGroupSearch: '',
      isLoadingCNGroups: false,
      isExportingExcel: false,
      cnGroupSearchTimeout: null,
      branches: [],
      selectedBranch: null,
      selectedDate: new Date(),
      barcodeValue: '',
      isScanning: false,
      lastStatus: null,
      sessionCount: 0,
      history: [],
      summary: { totalSamples: 0, awaitingReceiveCount: 0, receivedCount: 0, totalPatients: 0, awaitingReceivePatientCount: 0, receivedPatientCount: 0, stations: [] },
      isLoadingSummary: false,
      drilldown: null,
      drilldownSearch: '',
      drilldownSearchTimeout: null,
      drilldownScanStatus: 'awaitingReceive',
      drilldownStatusOptions: [
        { value: 'awaitingReceive', label: 'รอเช็ค' },
        { value: 'received', label: 'Lab รับแล้ว' },
        { value: 'all', label: 'ทั้งหมด' },
      ],
      drilldownLoading: false,
      drilldownPatients: [],
      drilldownApiSummary: {},
      drilldownPagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      recheckUpdateUnsubscribe: null,
      exceptionPendingCount: 0,
      showExceptionsModal: false,
      exceptionsLoading: false,
      exceptions: [],
      exceptionStatusFilter: 'PENDING',
      exceptionStatusOptions: [
        { value: 'PENDING', label: 'รอตรวจสอบ' },
        { value: 'RESOLVED', label: 'แก้ไขแล้ว' },
        { value: 'DISMISSED', label: 'ไม่ใช่ปัญหา' },
        { value: 'all', label: 'ทั้งหมด' },
      ],
      updatedKeys: [],
      updateTimers: {},
      exceptionCountLoaded: false,
    }
  },

  computed: {
    selectedCNGroupId() { return this.selectedCNGroup?.id || null },
    selectedCNGroupName() { return this.selectedCNGroup?.name || null },
    isReady() {
      return this.mode === 'checkup' ? !!this.selectedCNGroupId : !!this.selectedDate
    },
  },

  watch: {
    selectedCNGroup(newVal, oldVal) {
      if ((newVal?.id || null) === (oldVal?.id || null) || this.mode !== 'checkup') return
      this.resetSession()
      if (newVal) {
        this.loadSummary()
        this.loadExceptionPendingCount()
      }
      this.subscribeRecheckRealtime(newVal?.id || null)
    },
    drilldownScanStatus() {
      this.drilldownPagination.page = 1
      this.loadDrilldownPatients()
    },
    exceptionStatusFilter() {
      if (this.showExceptionsModal) this.loadExceptions()
    },
  },

  async mounted() {
    await Promise.all([this.loadBranches(), this.loadCNGroups()])
    if (this.isReady) {
      this.loadSummary()
      this.loadExceptionPendingCount()
    }
    if (this.mode === 'checkup' && this.selectedCNGroupId) this.subscribeRecheckRealtime(this.selectedCNGroupId)
    this.$nextTick(() => this.$refs.barcodeInput?.focus())
  },

  beforeUnmount() {
    if (this.recheckUpdateUnsubscribe) this.recheckUpdateUnsubscribe()
    Object.values(this.updateTimers).forEach((timer) => clearTimeout(timer))
  },

  methods: {
    subscribeRecheckRealtime(cnGroupId) {
      if (this.recheckUpdateUnsubscribe) {
        this.recheckUpdateUnsubscribe()
        this.recheckUpdateUnsubscribe = null
      }
      if (!cnGroupId || this.mode !== 'checkup') return
      this.recheckUpdateUnsubscribe = subscribeToRecheckUpdate(cnGroupId, () => {
        this.loadSummary(true)
        this.loadExceptionPendingCount()
      })
    },

    async loadCNGroups(search = '') {
      this.isLoadingCNGroups = true
      try {
        this.cnGroups = await cnGroupService.getAllForDropdown(search, 50, null, true)
      } catch { this.cnGroups = [] } finally { this.isLoadingCNGroups = false }
    },

    onCNGroupSearchInput() {
      if (this.cnGroupSearchTimeout) clearTimeout(this.cnGroupSearchTimeout)
      this.cnGroupSearchTimeout = setTimeout(() => this.loadCNGroups(this.cnGroupSearch), 500)
    },

    async exportRecheckExcel() {
      if (!this.selectedCNGroupId || this.isExportingExcel) return

      const confirm = await Swal.fire({
        icon: 'question',
        title: 'Export Excel',
        text: `ดาวน์โหลดรายงาน Recheck LAB ของ "${this.selectedCNGroupName}" ใช่ไหม?`,
        showCancelButton: true,
        confirmButtonText: 'Export',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#696CFF',
      })
      if (!confirm.isConfirmed) return

      this.isExportingExcel = true
      try {
        const dateStr = new Date().toISOString().slice(0, 10)
        const safeName = (this.selectedCNGroupName || 'recheck').replace(/[^a-zA-Z0-9ก-๙_-]/g, '_')
        await exportRecheck(this.selectedCNGroupId, `recheck_${safeName}_${dateStr}.xlsx`)
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Export ไม่สำเร็จ',
          text: err?.message || 'เกิดข้อผิดพลาดในการ export Excel',
        })
      } finally {
        this.isExportingExcel = false
      }
    },

    async loadBranches() {
      try {
        const res = await recheckScanService.getBranches()
        this.branches = res.data || res || []
      } catch { this.branches = [] }
    },

    // silent=true ใช้ตอน refresh เบื้องหลังจาก realtime signal — ไม่ toggle isLoadingSummary
    // เพื่อไม่ให้การ์ดกระพริบเป็น skeleton ทุกครั้งที่มีคนอื่น recheck (เหมือน ScanDashboard.vue
    // ที่แยก isUpdating ออกจาก isLoading) และถ้าพลาดก็ไม่ล้างข้อมูลเดิมทิ้ง แค่ log เฉยๆ
    async loadSummary(silent = false) {
      if (this.mode !== 'checkup' || !this.selectedCNGroupId) return
      if (!silent) this.isLoadingSummary = true
      const prev = silent ? this.summary : null
      try {
        const res = await recheckScanService.getRecheckSummary(this.selectedCNGroupId)
        const next = res.data || { totalSamples: 0, awaitingReceiveCount: 0, receivedCount: 0, totalPatients: 0, awaitingReceivePatientCount: 0, receivedPatientCount: 0, stations: [] }
        if (prev) this.markSummaryChanges(prev, next)
        this.summary = next
      } catch (err) {
        if (silent) { console.error('Silent loadSummary refresh failed:', err); return }
        this.summary = { totalSamples: 0, awaitingReceiveCount: 0, receivedCount: 0, totalPatients: 0, awaitingReceivePatientCount: 0, receivedPatientCount: 0, stations: [] }
      } finally {
        if (!silent) this.isLoadingSummary = false
      }
    },

    // เทียบของเก่ากับของใหม่ ให้เห็นว่าการ์ดไหน "เพิ่งเปลี่ยนจริง" แล้วติดไฮไลท์วูบให้เฉพาะการ์ดนั้น
    // (เหมือน ScanDashboard.vue checkForUpdates) — เทียบก่อน overwrite this.summary เท่านั้น
    markSummaryChanges(prev, next) {
      // แยก key ต่อการ์ด ไม่รวมเป็นก้อนเดียว — กัน "ทั้งหมด" กระพริบทั้งที่ตัวเลขตัวเองไม่ได้เปลี่ยน
      // เพียงเพราะมีการ์ดข้างๆ ขยับ (เช่น recheck สำเร็จ 1 ราย รอเช็คลด/รับแล้วเพิ่ม แต่ทั้งหมดเท่าเดิม)
      if (prev.totalSamples !== next.totalSamples) this.markKeyUpdated('total')
      if (prev.awaitingReceiveCount !== next.awaitingReceiveCount) this.markKeyUpdated('awaiting')
      if (prev.receivedCount !== next.receivedCount) this.markKeyUpdated('received')
      const prevStations = new Map((prev.stations || []).map(s => [s.stationId, s]))
      for (const st of next.stations || []) {
        const old = prevStations.get(st.stationId)
        if (!old || old.total !== st.total || old.awaitingReceive !== st.awaitingReceive || old.received !== st.received) {
          this.markKeyUpdated(`station-${st.stationId}`)
        }
      }
    },

    isKeyUpdated(key) {
      return this.updatedKeys.includes(key)
    },
    markKeyUpdated(key) {
      if (!this.updatedKeys.includes(key)) this.updatedKeys.push(key)
      if (this.updateTimers[key]) clearTimeout(this.updateTimers[key])
      this.updateTimers[key] = setTimeout(() => {
        this.updatedKeys = this.updatedKeys.filter(k => k !== key)
        delete this.updateTimers[key]
      }, 3000)
    },

    async loadExceptionPendingCount() {
      if (this.mode !== 'checkup' || !this.selectedCNGroupId) return
      try {
        const res = await recheckScanService.getRecheckExceptions(this.selectedCNGroupId, { status: 'PENDING', limit: 1 })
        const next = res.pendingCount || 0
        if (this.exceptionCountLoaded && next !== this.exceptionPendingCount) this.markKeyUpdated('exceptions')
        this.exceptionPendingCount = next
        this.exceptionCountLoaded = true
      } catch { this.exceptionPendingCount = 0 }
    },

    openExceptionsModal() {
      this.showExceptionsModal = true
      this.exceptionStatusFilter = 'PENDING'
      this.loadExceptions()
    },

    closeExceptionsModal() {
      this.showExceptionsModal = false
      this.exceptions = []
    },

    async loadExceptions() {
      if (!this.selectedCNGroupId) return
      this.exceptionsLoading = true
      try {
        const res = await recheckScanService.getRecheckExceptions(this.selectedCNGroupId, { status: this.exceptionStatusFilter, limit: 50 })
        this.exceptions = res.data || []
        this.exceptionPendingCount = res.pendingCount || 0
      } catch {
        this.exceptions = []
      } finally {
        this.exceptionsLoading = false
      }
    },

    async resolveException(ex, status) {
      const isDismiss = status === 'DISMISSED'
      const result = await Swal.fire({
        title: isDismiss ? 'ยืนยันว่าไม่ใช่ปัญหา?' : 'บันทึกว่าแก้ไขแล้ว',
        input: 'textarea',
        inputPlaceholder: isDismiss ? 'เช่น ยิงผิดคน ไม่ใช่เคสจริง' : 'เช่น เช็คแล้ว หน้างานลืมยิงจริง ให้ยิงเพิ่มแล้ว',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#696CFF',
      })
      if (!result.isConfirmed) return

      try {
        const res = await recheckScanService.resolveRecheckException(ex.id, status, result.value || '')
        if (res.success) {
          await this.loadExceptions()
        } else {
          Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: res.message || 'เกิดข้อผิดพลาด' })
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err?.response?.data?.message || 'เกิดข้อผิดพลาด' })
      }
    },

    switchMode(newMode) {
      if (newMode === this.mode) return
      this.mode = newMode
      this.resetSession()
      this.$nextTick(() => this.$refs.barcodeInput?.focus())
      if (this.isReady) {
        this.loadSummary()
        this.loadExceptionPendingCount()
      }
      this.subscribeRecheckRealtime(newMode === 'checkup' ? this.selectedCNGroupId : null)
    },

    resetSession() {
      this.barcodeValue = ''
      this.lastStatus = null
      this.history = []
      this.sessionCount = 0
      this.summary = { totalSamples: 0, awaitingReceiveCount: 0, receivedCount: 0, totalPatients: 0, awaitingReceivePatientCount: 0, receivedPatientCount: 0, stations: [] }
      this.drilldown = null
      this.patientSearch = ''
      this.exceptionPendingCount = 0
      this.exceptionCountLoaded = false
      // เคลียร์ไฮไลท์ค้างจาก CNGroup เก่า กัน key ชนกัน (เช่น station-5 ของกลุ่มใหม่ดันติดไฮไลท์
      // ค้างจากกลุ่มเก่าที่มี stationId ตรงกันโดยบังเอิญ)
      Object.values(this.updateTimers).forEach((timer) => clearTimeout(timer))
      this.updateTimers = {}
      this.updatedKeys = []
    },

    clearHistory() {
      this.history = []
      this.sessionCount = 0
      this.lastStatus = null
    },

    openDrilldown(station) {
      this.drilldown = station
      this.drilldownSearch = ''
      this.drilldownScanStatus = station.awaitingReceive > 0 ? 'awaitingReceive' : 'received'
      this.drilldownPagination = { page: 1, limit: 20, total: 0, totalPages: 1 }
      this.drilldownPatients = []
      this.drilldownApiSummary = {}
      this.loadDrilldownPatients()
    },

    closeDrilldown() {
      this.drilldown = null
      this.drilldownSearch = ''
      this.drilldownPatients = []
      if (this.drilldownSearchTimeout) clearTimeout(this.drilldownSearchTimeout)
    },

    async loadDrilldownPatients() {
      if (!this.drilldown || !this.selectedCNGroupId) return
      this.drilldownLoading = true
      try {
        const res = await recheckScanService.getRecheckStationPatients(
          this.selectedCNGroupId,
          this.drilldown.stationId,
          {
            scanStatus: this.drilldownScanStatus,
            search: this.drilldownSearch,
            page: this.drilldownPagination.page,
            limit: this.drilldownPagination.limit,
          }
        )
        this.drilldownPatients = res.data || []
        this.drilldownApiSummary = res.summary || {}
        this.drilldownPagination = { ...this.drilldownPagination, ...res.pagination }
      } catch {
        this.drilldownPatients = []
      } finally {
        this.drilldownLoading = false
      }
    },

    onDrilldownSearchInput() {
      if (this.drilldownSearchTimeout) clearTimeout(this.drilldownSearchTimeout)
      this.drilldownSearchTimeout = setTimeout(() => {
        this.drilldownPagination.page = 1
        this.loadDrilldownPatients()
      }, 400)
    },

    drilldownPageChange(page) {
      this.drilldownPagination.page = page
      this.loadDrilldownPatients()
    },

    focusInput() {
      this.$nextTick(() => this.$refs.barcodeInput?.focus())
    },

    async cancelRecheck(entry) {
      try {
        let scanItemId = entry.scanItemId
        if (!scanItemId) {
          const check = await recheckScanService.recheckCheckup(entry.barcode, this.selectedCNGroupId)
          scanItemId = check.scanItemId
        }
        if (!scanItemId) return
        const res = await recheckScanService.cancelRecheck(scanItemId)
        if (res.success) {
          entry.status = 'cancelled'
          entry.scanItemId = null
          this.loadSummary(true)
        }
      } catch { /* ignore */ }
    },

    async handleRecheck() {
      const raw = this.barcodeValue.trim()
      if (!raw || this.isScanning || !this.isReady) return

      this.isScanning = true
      const now = new Date()
      const time = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      try {
        let res
        if (this.mode === 'checkup') {
          res = await recheckScanService.recheckCheckup(raw, this.selectedCNGroupId)
        } else {
          const date = this.selectedDate instanceof Date
            ? this.selectedDate.toISOString().split('T')[0]
            : this.selectedDate
          res = await recheckScanService.recheckClinic(raw, this.selectedBranch?.id || null, date)
        }

        const isNew = res.isNewRecheck === true
        const name = res.patient
          ? `${res.patient.prefix || ''}${res.patient.first_name} ${res.patient.last_name}`
          : null

        this.history.unshift({
          status: isNew ? 'ok' : 'duplicate',
          barcode: raw,
          name,
          station: res.station?.name,
          scanItemId: res.scanItemId || null,
          time,
        })

        if (isNew) {
          this.lastStatus = 'ok'
          this.sessionCount++
          this.playSound('success')
          // รีเฟรช summary จาก server แทนการ patch ตัวเลขในเครื่อง กันตัวเลขเพี้ยนจากของจริง —
          // silent เพราะยิงรัวๆ ด้วย barcode gun ได้ ไม่อยากให้กระพริบ skeleton ทุกครั้ง
          this.loadSummary(true)
        } else {
          this.lastStatus = 'duplicate'
          this.playSound('duplicate')
        }
      } catch (err) {
        // backend ตอบ HTTP 400 เสมอตอน success:false → axios throw ตรงนี้เลย (ไม่ resolve เป็น
        // res.success:false ให้เช็คแบบปกติ)
        const msg = err?.response?.data?.message || null
        this.history.unshift({ status: 'error', barcode: raw, time, message: msg })
        this.lastStatus = 'error'
        this.playSound('error')
        // อาจเพิ่งสร้าง RecheckException ไว้ (ไม่พบ CN / ไม่พบการยิงจากหน้างาน) — เช็คตัวเลขใหม่
        this.loadExceptionPendingCount()
      } finally {
        this.isScanning = false
        this.barcodeValue = ''
        this.$nextTick(() => this.$refs.barcodeInput?.focus())
      }
    },

    formatDate(dateString) {
      if (!dateString) return '-'
      return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(dateString))
    },

    playSound(type) {
      try {
        const el = type === 'success' ? this.$refs.audioSuccess
          : type === 'error' ? this.$refs.audioError
          : this.$refs.audioDuplicate
        if (el) { el.currentTime = 0; el.play() }
      } catch { /* ignore */ }
    },
  },
}
</script>

<style scoped>
/* เหมือน ScanDashboard.vue — glow วูบเดียวตอนการ์ดอัปเดตจาก realtime signal (ไม่ใช่ตอนโหลดครั้งแรก) */
@keyframes pulse-update {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

.animate-pulse-update {
  animation: pulse-update 1s ease-in-out infinite;
}
</style>
