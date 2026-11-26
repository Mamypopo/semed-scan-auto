<template>
  <audio ref="audioSuccess" src="/sounds/1-correct-2-46134.mp3" preload="auto" />
  <audio ref="audioError" src="/sounds/2-wronganswer-37702.mp3" preload="auto" />
  <audio ref="audioDuplicate" src="/sounds/3-duplicate.mp3" preload="auto" />

  <div class="space-y-6">

    <!-- HEADER BAR -->
    <div class="rounded-ds-card border border-ds-line bg-ds-surface p-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">

        <!-- Mode Toggle -->
        <div class="inline-flex bg-ds-sunken border border-ds-line rounded-ds-md p-0.5 flex-shrink-0" role="group" aria-label="โหมด">
          <button
            v-for="m in modes" :key="m.value"
            type="button"
            :aria-pressed="mode === m.value"
            @click="switchMode(m.value)"
            :class="['px-3 py-1.5 text-sm font-semibold rounded-ds-sm transition-colors',
              mode === m.value ? 'bg-ds-primary text-white' : 'text-ds-ink-2 hover:text-ds-ink']"
          >{{ m.label }}</button>
        </div>

        <!-- Checkup: CNGroup (ค้นหาจาก server — ของหน้านี้เอง ไม่ผูกกับ Sidebar) -->
        <template v-if="mode === 'checkup'">
          <BaseCombobox
            :model-value="selectedCNGroupId"
            :options="cnGroupOptions"
            :filter-local="false"
            :loading="isLoadingCNGroups"
            clearable
            placeholder="เลือก CNGroup"
            aria-label="CNGroup"
            class="w-full sm:w-[28rem]"
            @search="onCNGroupSearch"
            @update:model-value="onCNGroupPick"
          />

          <BaseButton
            v-if="selectedCNGroupId"
            variant="secondary"
            :loading="isExportingExcel"
            v-tooltip:top="'ดาวน์โหลดรายงาน Recheck LAB เป็น Excel'"
            @click="exportRecheckExcel"
          >
            <Download v-if="!isExportingExcel" class="w-4 h-4" aria-hidden="true" />
            {{ isExportingExcel ? 'กำลังสร้างไฟล์...' : 'Export Excel' }}
          </BaseButton>
        </template>

        <!-- Clinic: Branch + VueDatePicker -->
        <template v-else>
          <BaseSelect :model-value="selectedBranch?.id ?? ''" :options="branchSelectOptions" aria-label="สาขา" class="w-full sm:w-52" @update:model-value="onBranchPick" />

          <VueDatePicker
            v-model="selectedDate"
            :enable-time-picker="false"
            format="dd/MM/yyyy"
            locale="th"
            placeholder="เลือกวันที่"
            auto-apply
            class="ds-datepicker w-full sm:w-48"
          />
        </template>
      </div>
    </div>


    <div v-if="!isReady" class="rounded-ds-card border border-dashed border-ds-line-strong bg-ds-surface p-12 flex flex-col items-center text-center">
      <div class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-ds-icon bg-ds-sunken text-ds-ink-3">
        <FlaskConical class="w-6 h-6" aria-hidden="true" />
      </div>
      <p class="text-base font-semibold text-ds-ink mb-1">ยังไม่ได้เลือก CNGroup</p>
      <p class="text-sm text-ds-ink-2">กรุณาเลือก CNGroup ด้านบนก่อนเริ่มใช้งาน</p>
    </div>


    <div v-else class="flex flex-col md:flex-row gap-4">

      <!-- LEFT: Scan input + History -->
      <div class="w-full md:w-[45%] space-y-4">

        <!-- Scan Card -->
        <div class="bg-ds-surface rounded-ds-card border transition-all"
          :class="{
            'border-ds-status-success-dot': lastStatus === 'ok',
            'border-ds-danger': lastStatus === 'error',
            'border-ds-hue-yellow-mid': lastStatus === 'duplicate',
            'border-ds-line': !lastStatus,
          }"
        >
          <div class="px-5 py-4 border-b border-ds-line">
            <div class="flex items-center gap-3">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-ds-md bg-ds-status-info-bg text-ds-status-info-text">
                <ScanLine class="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <h2 class="text-base font-semibold text-ds-ink">ยิง Recheck</h2>
              <span class="ml-auto text-xs font-mono text-ds-ink-3">{{ mode === 'checkup' ? 'CN.StationID' : 'HN.StationID' }}</span>
            </div>
          </div>
          <div class="p-4 space-y-3">
            <!-- เลือกจุดตรวจก่อนยิง — บาร์โค้ดที่ไม่ใช่จุดที่เลือกจะถูกปฏิเสธก่อนส่งไป server
                 (แบบเดียวกับหน้าสแกนจุดตรวจ) กันหยิบตัวอย่างผิดประเภทมายิงรับ -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-semibold text-ds-ink-2">จุดตรวจที่รับ</span>
                <button
                  v-if="selectedStationIds.length > 0"
                  type="button"
                  @click="selectedStationIds = []"
                  class="inline-flex items-center gap-1 text-[11px] font-medium text-ds-danger hover:underline focus:outline-none"
                >
                  <X class="w-3 h-3" aria-hidden="true" /> ล้าง
                </button>
              </div>

              <Listbox v-model="selectedStationIds" multiple as="div" class="relative">
                <ListboxButton
                  class="w-full flex items-center gap-2.5 px-3 py-2.5 border border-ds-line rounded-ds-md bg-ds-surface text-left hover:border-ds-primary transition-all focus:outline-none focus:ring-2 focus-visible:ring-ds-primary/30"
                >
                  <span
                    :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                      selectedStationIds.length ? 'bg-ds-status-info-text text-white' : 'bg-ds-sunken text-ds-ink-3']"
                  >{{ selectedStationIds.length || '?' }}</span>
                  <span class="flex-1 text-sm font-medium text-ds-ink">
                    {{ selectedStationIds.length ? `เลือก ${selectedStationIds.length} จุดตรวจ` : 'กรุณาเลือกจุดตรวจ' }}
                  </span>
                  <ChevronDown class="w-4 h-4 text-ds-ink-3 flex-shrink-0" />
                </ListboxButton>

                <transition enter-active-class="transition ease-out duration-100" enter-from-class="opacity-0 scale-95"
                  enter-to-class="opacity-100 scale-100" leave-active-class="transition ease-in duration-75"
                  leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
                  <ListboxOptions
                    class="absolute z-30 mt-1 w-full bg-ds-surface border border-ds-line rounded-ds-md focus:outline-none overflow-hidden flex flex-col"
                  >
                    <div class="p-2 border-b border-ds-line">
                      <div>
                        <BaseInput
                          v-model.trim="stationSearch"
                          type="text"
                          size="sm"
                          placeholder="ค้นหาจุดตรวจ..."
                          aria-label="ค้นหาจุดตรวจ"
                          @click.stop
                          @keydown.space.stop
                        >
                          <template #leading><SearchIcon class="h-4 w-4" aria-hidden="true" /></template>
                        </BaseInput>
                      </div>
                    </div>
                    <div class="overflow-y-auto max-h-60 p-1">
                      <div v-if="filteredLabStations.length === 0" class="px-3 py-4 text-center text-xs text-ds-ink-3">
                        {{ labStations.length ? 'ไม่พบจุดตรวจที่ค้นหา' : 'กำลังโหลด...' }}
                      </div>
                      <ListboxOption
                        v-for="st in filteredLabStations" :key="st.id" :value="st.id"
                        v-slot="{ active, selected }"
                      >
                        <li :class="['flex items-center gap-2.5 px-2.5 py-2 rounded-ds-md cursor-pointer text-sm transition-colors',
                          active ? 'bg-ds-primary-tint' : '', selected ? 'bg-ds-primary-tint/40' : '']">
                          <BaseCheckbox :model-value="selected" tabindex="-1" class="pointer-events-none" />
                          <span :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                            selected ? 'bg-ds-status-info-text text-white' : 'bg-ds-sunken text-ds-ink-3']">{{ st.id }}</span>
                          <span class="flex-1 min-w-0 truncate text-ds-ink">{{ st.name }}</span>
                        </li>
                      </ListboxOption>
                    </div>
                  </ListboxOptions>
                </transition>
              </Listbox>

              <div v-if="selectedLabStations.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-for="st in selectedLabStations" :key="st.id"
                  class="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 bg-ds-status-info-bg text-ds-status-info-text rounded-ds-md text-xs font-semibold border border-ds-status-info-dot/20"
                >
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-ds-status-info-text text-white">{{ st.id }}</span>
                  <span class="truncate max-w-[140px]">{{ st.name }}</span>
                  <button type="button" :aria-label="'เอาจุดตรวจ ' + st.name + ' ออก'" @click="removeStation(st.id)" class="hover:text-ds-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-primary rounded-ds-xs">
                    <X class="w-3 h-3" aria-hidden="true" />
                  </button>
                </span>
              </div>
            </div>

            <BaseInput
              ref="barcodeInput"
              v-model="barcodeValue"
              type="text"
              :disabled="selectedStationIds.length === 0"
              :placeholder="selectedStationIds.length ? 'ยิงบาร์โค้ดแล้วกด Enter...' : 'เลือกจุดตรวจก่อนถึงจะยิงได้'"
              aria-label="ยิงบาร์โค้ด Recheck"
              class="font-mono"
              autocomplete="off"
              @keyup.enter="handleRecheck"
            />
            <div class="flex items-center justify-between">
              <span class="text-xs text-ds-ink-2">
                session นี้ recheck แล้ว
                <span class="font-semibold text-ds-primary">{{ sessionCount }}</span> ครั้ง
              </span>
              <button type="button" @click="clearHistory" class="text-xs text-ds-ink-3 hover:text-ds-danger transition-colors focus:outline-none">ล้าง history</button>
            </div>
          </div>
        </div>

        <!-- History Card -->
        <div class="bg-ds-surface rounded-ds-card border border-ds-line overflow-hidden">
          <div class="px-4 py-3 border-b border-ds-line flex items-center gap-2">
            <ClockIcon class="w-4 h-4 text-ds-ink-3" />
            <span class="text-sm font-semibold text-ds-ink">ประวัติการ Recheck</span>
          </div>
          <div v-if="history.length === 0" class="py-10 text-center text-sm text-ds-ink-3">
            ยังไม่มีการยิงบาร์โค้ด
          </div>
          <ul v-else class="divide-y divide-ds-line max-h-[400px] overflow-y-auto">
            <li
              v-for="(entry, i) in history" :key="i"
              class="px-4 py-3 hover:bg-ds-sunken transition-colors"
              :class="{ 'opacity-50': entry.status === 'cancelled' }"
            >
              <div class="flex items-start gap-3">
                <!-- Status badge -->
                <div class="mt-0.5 flex-shrink-0">
                  <StatusBadge :tone="entry.status === 'ok' ? 'success' : entry.status === 'duplicate' ? 'warning' : entry.status === 'cancelled' ? 'neutral' : 'danger'" dot class="!text-[10px]">
                    {{ entry.status === 'ok' ? 'สำเร็จ'
                      : entry.status === 'duplicate' ? 'ซ้ำ'
                      : entry.status === 'cancelled' ? 'ยกเลิก'
                      : 'ผิดพลาด' }}
                  </StatusBadge>
                </div>
                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p v-if="entry.name" class="text-sm font-medium text-ds-ink truncate">{{ entry.name }}</p>
                  <p v-else class="text-sm text-ds-ink-2">{{ entry.barcode }}</p>
                  <div class="flex items-center gap-2 mt-0.5 text-xs text-ds-ink-3">
                    <span class="font-mono">{{ entry.barcode }}</span>
                    <span v-if="entry.station">· {{ entry.station }}</span>
                  </div>
                  <p v-if="entry.message"
                    :class="['mt-0.5 text-xs', entry.status === 'error' ? 'text-ds-danger' : 'text-ds-status-warning-text']"
                  >{{ entry.message }}</p>
                </div>
                <!-- Time + cancel -->
                <div class="flex flex-col items-end gap-1 flex-shrink-0">
                  <span class="text-xs text-ds-ink-3">{{ entry.time }}</span>
                  <!-- รับไว้ก่อน (รอทะเบียน) ยังไม่มีแถวการยิงให้ยกเลิก -->
                  <button
                    v-if="(entry.status === 'ok' || entry.status === 'duplicate') && entry.scanItemId"
                    type="button"
                    class="text-[10px] px-2 py-0.5 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-danger/30 text-ds-danger bg-ds-status-danger-bg hover:border-ds-danger hover:bg-ds-danger-soft"
                    @click="cancelRecheck(entry)"
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
            <div v-for="n in 4" :key="n" class="h-12 bg-ds-sunken animate-pulse rounded-ds-md" />
          </div>
        </template>
        <div v-else class="grid grid-cols-4 gap-2">
          <div
            :class="['flex flex-col gap-0.5 px-3 py-2 bg-ds-status-info-bg border rounded-ds-md transition-all',
              isKeyUpdated('total') ? 'animate-pulse-update ring-2 ring-ds-status-info-dot/30 scale-105 border-ds-status-info-dot/50' : 'border-ds-status-info-dot/20']"
          >
            <span class="text-xs font-medium text-ds-status-info-text">ทั้งหมด</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ds-status-info-text">{{ summary.totalSamples }}</span>
              <span class="text-[10px] text-ds-status-info-text opacity-70">ตัวอย่าง</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-sm font-bold text-ds-status-info-text">{{ summary.totalPatients }}</span>
              <span class="text-[10px] text-ds-status-info-text opacity-70">คน</span>
            </div>
          </div>
          <div
            :class="['flex flex-col gap-0.5 px-3 py-2 bg-ds-status-warning-bg border rounded-ds-md transition-all',
              isKeyUpdated('awaiting') ? 'animate-pulse-update ring-2 ring-ds-hue-yellow-mid/30 scale-105 border-ds-hue-yellow-mid/50' : 'border-ds-hue-yellow-mid/20']"
          >
            <span class="text-xs font-medium text-ds-status-warning-text">รอเช็ค</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ds-status-warning-text">{{ summary.awaitingReceiveCount }}</span>
              <span class="text-[10px] text-ds-status-warning-text opacity-70">ตัวอย่าง</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-sm font-bold text-ds-status-warning-text">{{ summary.awaitingReceivePatientCount }}</span>
              <span class="text-[10px] text-ds-status-warning-text opacity-70">คน</span>
            </div>
          </div>
          <div
            :class="['flex flex-col gap-0.5 px-3 py-2 bg-ds-status-success-bg border rounded-ds-md transition-all',
              isKeyUpdated('received') ? 'animate-pulse-update ring-2 ring-ds-status-success-dot/30 scale-105 border-ds-status-success-dot/50' : 'border-ds-status-success-dot/20']"
          >
            <span class="text-xs font-medium text-ds-status-success-text">Lab รับแล้ว</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ds-status-success-text">{{ summary.receivedCount }}</span>
              <span class="text-[10px] text-ds-status-success-text opacity-70">ตัวอย่าง</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-sm font-bold text-ds-status-success-text">{{ summary.receivedPatientCount }}</span>
              <span class="text-[10px] text-ds-status-success-text opacity-70">คน</span>
            </div>
          </div>
          <button
            type="button"
            @click="openExceptionsModal"
            :class="['flex flex-col gap-0.5 px-3 py-2 bg-ds-status-danger-bg border rounded-ds-md text-left transition-all focus:outline-none',
              isKeyUpdated('exceptions') ? 'animate-pulse-update ring-2 ring-ds-danger/25 scale-105 border-ds-danger/50' : 'border-ds-danger/20']"
          >
            <!-- ทุกเรื่องที่ยังไม่จบ = จำนวนแถวในแท็บรอตรวจสอบ (รวมรายการที่รอทะเบียน) -->
            <span class="text-xs font-medium text-ds-danger">ต้องตรวจสอบ</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ds-danger">{{ exceptionPendingCount }}</span>
              <span class="text-[10px] text-ds-danger opacity-70">รายการ</span>
            </div>
            <span class="text-[10px] text-ds-danger opacity-70">กดดูรายละเอียด</span>
          </button>
        </div>

        <!-- Station Cards -->
        <div v-if="isLoadingSummary" class="grid grid-cols-2 gap-2">
          <div v-for="n in 4" :key="n" class="h-16 bg-ds-sunken animate-pulse rounded-ds-md" />
        </div>
        <div v-else-if="summary.stations?.length" class="grid grid-cols-2 gap-2">
          <button
            v-for="st in summary.stations" :key="st.stationId"
            @click="openDrilldown(st)"
            class="bg-ds-surface rounded-ds-md border text-left focus:outline-none transition-all"
            :class="isKeyUpdated(`station-${st.stationId}`)
              ? 'animate-pulse-update ring-2 ring-ds-primary/25 scale-105 border-ds-primary/50'
              : st.needsReview > 0
                ? 'border-ds-danger/40 hover:border-ds-danger/70'
                : (st.awaitingReceive === 0 ? 'border-ds-status-success-dot/30 hover:border-ds-status-success-dot/60' : 'border-ds-line hover:border-ds-primary/30')"
          >
            <div class="px-3 py-2.5">
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-[10px] font-mono font-bold text-ds-primary flex-shrink-0">#{{ st.stationId }}</span>
                  <p class="text-xs font-semibold text-ds-ink truncate">{{ st.stationName }}</p>
                </div>
                <!-- มีตัวอย่างค้างตรวจสอบ = ห้ามขึ้น "ครบ" ต่อให้ยอดปกติจะครบแล้ว ถาดยังมีตัวอย่างที่ไม่มีใครตัดสิน -->
                <StatusBadge :tone="st.needsReview > 0 ? 'danger' : st.awaitingReceive === 0 ? 'success' : 'warning'" dot class="flex-shrink-0 !text-[10px]">
                  {{ st.needsReview > 0 ? 'ตรวจสอบ' : st.awaitingReceive === 0 ? 'ครบ' : 'รอเช็ค ' + st.awaitingReceive }}
                </StatusBadge>
              </div>
              <div class="flex items-center justify-between gap-2 text-xs text-ds-ink-2">
                <span class="flex items-center gap-2 flex-wrap">
                  <span>รับแล้ว <span class="font-semibold text-ds-status-success-text">{{ st.received }}</span></span>
                  <!-- วางคู่กับรับแล้ว ให้คนนับของในถาดเห็นทันทีว่า ถาด = รับแล้ว + ค้าง (ค้างไม่อยู่ในทั้งหมด) -->
                  <span v-if="st.needsReview > 0" class="text-ds-danger">
                    + ค้างตรวจสอบ <span class="font-bold">{{ st.needsReview }}</span>
                  </span>
                </span>
                <span class="flex-shrink-0">ทั้งหมด <span class="font-semibold text-ds-ink">{{ st.total }}</span></span>
              </div>
              <!-- รับไว้ก่อนแล้ว (นับในรับแล้ว) แต่หน้างานยังไม่มีการยิง รอทะเบียนบันทึกตาม -->
              <p v-if="st.awaitingRegistration > 0" class="mt-1 text-[10px] font-semibold text-ds-status-warning-text">
                ในนี้รอทะเบียนบันทึกการยิง {{ st.awaitingRegistration }}
              </p>
              <!-- ตัวอย่างที่ Lab รับไว้แต่ไม่มีการยิงรองรับ (ทะเบียนปฏิเสธ / รายการหน้างานถูกยกเลิก) -->
              <p v-if="st.needsReview > 0" class="mt-1 text-[10px] text-ds-danger">
                ไม่นับในยอด เพราะไม่มีการยิงจากหน้างาน — กดเพื่อจัดการ
              </p>
            </div>
          </button>
        </div>

      </div>
    </div>

    <!-- DRILLDOWN MODAL -->
    <TransitionRoot appear :show="!!drilldown" as="template">
      <HeadlessDialog as="div" class="relative z-50" @close="closeDrilldown">
        <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-ds-overlay/30 transition-opacity" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="ease-in duration-200" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
              <DialogPanel class="w-full max-w-[90vw] max-h-[90vh] transform rounded-ds-card bg-ds-surface  border border-ds-line flex flex-col overflow-hidden">

                <!-- Header -->
                <div class="px-6 pt-5 pb-4 border-b border-ds-line bg-ds-surface flex-shrink-0">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex min-w-0 items-center gap-3">
                      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-ds-md bg-ds-status-info-bg text-ds-status-info-text"><ScanLine class="h-[18px] w-[18px]" aria-hidden="true" /></span>
                      <DialogTitle class="min-w-0 truncate text-lg font-bold text-ds-ink">
                        {{ drilldown?.stationName }}
                      </DialogTitle>
                    </div>
                    <BaseButton variant="ghost" size="sm" icon aria-label="ปิด" @click="closeDrilldown">
                      <X class="w-5 h-5" aria-hidden="true" />
                    </BaseButton>
                  </div>
                  <!-- Summary badges (จาก API) -->
                  <div class="flex items-center gap-2 flex-wrap">
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-ds-status-info-bg rounded-ds-md">
                      <span class="text-xs font-medium text-ds-status-info-text">ทั้งหมด:</span>
                      <span class="text-sm font-bold text-ds-status-info-text">{{ drilldownApiSummary.total || drilldown?.total || 0 }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-ds-status-warning-bg rounded-ds-md">
                      <span class="text-xs font-medium text-ds-status-warning-text">รอเช็ค:</span>
                      <span class="text-sm font-bold text-ds-status-warning-text">{{ drilldownApiSummary.awaitingReceiveCount ?? drilldown?.awaitingReceive ?? 0 }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-ds-status-success-bg rounded-ds-md">
                      <span class="text-xs font-medium text-ds-status-success-text">Lab รับแล้ว:</span>
                      <span class="text-sm font-bold text-ds-status-success-text">{{ drilldownApiSummary.receivedCount ?? drilldown?.received ?? 0 }}</span>
                    </div>
                    <div v-if="drilldownApiSummary.needsReviewCount > 0" class="flex items-center gap-1.5 px-3 py-1.5 bg-ds-status-danger-bg rounded-ds-md">
                      <span class="text-xs font-medium text-ds-danger">ค้างตรวจสอบ (ไม่นับในยอด):</span>
                      <span class="text-sm font-bold text-ds-danger">{{ drilldownApiSummary.needsReviewCount }}</span>
                    </div>
                  </div>
                </div>

                <!-- Search + filter row -->
                <div class="px-6 py-3 border-b border-ds-line bg-ds-sunken flex-shrink-0">
                  <div class="flex items-center gap-3 flex-wrap">
                    <BaseInput v-model="drilldownSearch" type="text" placeholder="ค้นหาชื่อ, CN, บริษัท..." aria-label="ค้นหาในรายชื่อ" class="flex-1 min-w-[200px]" @input="onDrilldownSearchInput">
                      <template #leading><SearchIcon class="h-4 w-4" aria-hidden="true" /></template>
                    </BaseInput>
                    <div class="inline-flex bg-ds-surface border border-ds-line-strong rounded-ds-md p-0.5" role="group" aria-label="กรองตามสถานะ">
                      <button
                        v-for="opt in drilldownStatusOptions" :key="opt.value"
                        type="button"
                        :aria-pressed="drilldownScanStatus === opt.value"
                        @click="drilldownScanStatus = opt.value"
                        :class="['px-3 py-1.5 text-xs font-semibold rounded-ds-sm transition-colors',
                          drilldownScanStatus === opt.value ? 'bg-ds-primary-tint text-ds-primary ring-1 ring-inset ring-ds-primary/30' : 'text-ds-ink-2 hover:text-ds-ink']"
                      >{{ opt.label }}</button>
                    </div>
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-y-auto min-h-0">

                  <!-- ตัวอย่างค้างตรวจสอบ — แยกออกจากตาราง เพราะไม่ใช่ทั้งรับแล้วและรอเช็ค (ไม่นับในยอด)
                       แสดงทุกแท็บ จะได้ไม่มีทางมองข้าม จนกว่า Lab จะแจ้งทะเบียนใหม่หรือยกเลิกการรับ -->
                  <div v-if="!drilldownLoading && drilldownNeedsReview.length > 0" class="px-4 pt-4">
                    <div class="rounded-ds-md border border-ds-danger/30 bg-ds-status-danger-bg/40 p-3">
                      <p class="text-sm font-bold text-ds-danger">ตัวอย่างค้างตรวจสอบ {{ drilldownNeedsReview.length }} รายการ</p>
                      <p class="text-xs text-ds-ink-2 mt-0.5">
                        Lab รับไว้แล้ว แต่ไม่มีการยิงจากหน้างานรองรับ — ถ้าตัวอย่างถูกคน ให้ยิงตัวอย่างนี้อีกครั้งเพื่อแจ้งทะเบียนใหม่
                        ถ้าตัวอย่างผิดคนหรือคนไข้ไม่ได้ตรวจ ให้กดยกเลิกการรับ
                      </p>
                      <div class="mt-2 divide-y divide-ds-danger/15">
                        <div v-for="p in drilldownNeedsReview" :key="'nr-' + p.confirmationId" class="flex items-center justify-between gap-3 py-2 flex-wrap">
                          <div class="min-w-0 text-sm">
                            <StatusBadge hue="sky" class="mr-1.5">{{ p.cn || '-' }}</StatusBadge>
                            <span class="font-medium text-ds-ink">{{ p.name || '-' }}</span>
                            <StatusBadge tone="danger" class="ml-1.5 !text-[10px]">{{ p.reviewReason === 'REGISTRATION_REJECTED' ? 'ทะเบียนปฏิเสธ' : 'รายการหน้างานถูกยกเลิก' }}</StatusBadge>
                            <span class="ml-1.5 text-xs text-ds-ink-3">รับเมื่อ {{ formatDate(p.confirmedAt) }}</span>
                          </div>
                          <button type="button" class="text-[11px] px-2.5 py-1 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-danger/30 text-ds-danger bg-ds-surface hover:border-ds-danger hover:bg-ds-danger-soft flex-shrink-0" @click="cancelUnbackedReceipt({ confirmationId: p.confirmationId }, p.cn, p.name)">ยกเลิกการรับ</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Loading -->
                  <div v-if="drilldownLoading" class="p-4 space-y-2">
                    <div v-for="n in 6" :key="n" class="h-10 bg-ds-sunken animate-pulse rounded-ds-md" />
                  </div>

                  <!-- Empty -->
                  <div v-else-if="drilldownPatients.length === 0 && drilldownAwaitingRegistration.length === 0" class="py-10 flex flex-col items-center text-center">
                    <div class="w-10 h-10 bg-ds-status-success-bg rounded-ds-md flex items-center justify-center mx-auto mb-3">
                      <CheckCircle class="w-5 h-5 text-ds-status-success-text" />
                    </div>
                    <p class="text-sm font-semibold text-ds-ink">
                      {{ drilldownSearch ? 'ไม่พบข้อมูล' : (drilldownScanStatus === 'awaitingReceive' ? 'เช็คครบทุกรายแล้ว' : 'ยังไม่มีรายการ') }}
                    </p>
                  </div>

                  <!-- Table -->
                  <div v-else class="p-4">
                    <div class="rounded-ds-md border border-ds-line bg-ds-surface overflow-x-auto">
                      <table class="min-w-full divide-y divide-ds-line">
                        <thead>
                          <tr class="bg-ds-sunken">
                            <th class="px-4 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">CN</th>
                            <th class="px-4 py-3 text-left text-sm font-semibold text-ds-ink-2">ชื่อ-นามสกุล</th>
                            <th class="px-4 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">รหัสพนักงาน</th>
                            <th class="px-4 py-3 text-left text-sm font-semibold text-ds-ink-2">บริษัท</th>
                            <th class="px-4 py-3 text-left text-sm font-semibold text-ds-ink-2">แผนก</th>
                            <th class="px-4 py-3 text-left text-sm font-semibold text-ds-ink-2">ตำแหน่ง</th>
                            <th class="px-4 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">วันที่ลงทะเบียน</th>
                            <th v-if="drilldownScanStatus === 'all'" class="px-4 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-ds-line">
                          <!-- รับไว้ก่อน รอทะเบียนบันทึกการยิง — ไม่ได้อยู่ในหน้าที่แบ่งไว้ (ไม่มีแถวการยิง)
                               แสดงรวมไว้บนสุดของหน้าแรกทีเดียว มีไม่กี่รายการ -->
                          <template v-if="drilldownPagination.page === 1">
                            <tr v-for="p in drilldownAwaitingRegistration" :key="'lr-' + p.patientId" class="bg-ds-status-warning-bg/30">
                              <td class="px-4 py-3 whitespace-nowrap text-sm align-top">
                                <StatusBadge hue="sky">{{ p.cn || p.hn || '-' }}</StatusBadge>
                              </td>
                              <td class="px-4 py-3 text-sm font-medium text-ds-ink align-top whitespace-nowrap">
                                {{ p.name || '-' }}
                                <StatusBadge tone="warning" class="ml-1.5 !text-[10px]">รอทะเบียนบันทึกการยิง</StatusBadge>
                              </td>
                              <td class="px-4 py-3 text-sm text-ds-ink-2 align-top whitespace-nowrap">{{ p.employeeCode || '-' }}</td>
                              <td class="px-4 py-3 text-sm text-ds-ink-2 align-top">{{ p.companyName || '-' }}</td>
                              <td class="px-4 py-3 text-sm text-ds-ink-2 align-top whitespace-nowrap">{{ p.department || '-' }}</td>
                              <td class="px-4 py-3 text-sm text-ds-ink-2 align-top whitespace-nowrap">{{ p.position || '-' }}</td>
                              <td class="px-4 py-3 text-sm text-ds-ink-2 align-top whitespace-nowrap">{{ formatDate(p.registeredAt) }}</td>
                              <td v-if="drilldownScanStatus === 'all'" class="px-4 py-3 align-top whitespace-nowrap">
                                <StatusBadge tone="success" dot>Lab รับแล้ว (รอทะเบียน)</StatusBadge>
                              </td>
                            </tr>
                          </template>
                          <tr v-for="p in drilldownPatients" :key="p.patientId" class="hover:bg-ds-sunken transition-colors">
                            <td class="px-4 py-3 whitespace-nowrap text-sm align-top">
                              <StatusBadge hue="sky">{{ p.cn || p.hn || '-' }}</StatusBadge>
                            </td>
                            <td class="px-4 py-3 text-sm font-medium text-ds-ink align-top whitespace-nowrap">{{ p.name || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ds-ink-2 align-top whitespace-nowrap">{{ p.employeeCode || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ds-ink-2 align-top">{{ p.companyName || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ds-ink-2 align-top whitespace-nowrap">{{ p.department || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ds-ink-2 align-top whitespace-nowrap">{{ p.position || '-' }}</td>
                            <td class="px-4 py-3 text-sm text-ds-ink-2 align-top whitespace-nowrap">{{ formatDate(p.registeredAt) }}</td>
                            <td v-if="drilldownScanStatus === 'all'" class="px-4 py-3 align-top whitespace-nowrap">
                              <StatusBadge :tone="p.status === 'received' ? 'success' : 'warning'" dot>{{ p.status === 'received' ? 'Lab รับแล้ว' : 'รอเช็ค' }}</StatusBadge>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- Pagination footer -->
                <BasePagination v-if="drilldownPagination.totalPages > 1" compact :page="drilldownPagination.page" :page-size="drilldownPagination.limit" :total="drilldownPagination.total" :total-pages="drilldownPagination.totalPages" :loading="drilldownLoading" @update:page="drilldownPageChange" />

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
          <div class="fixed inset-0 bg-ds-overlay/30 transition-opacity" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="ease-in duration-200" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
              <DialogPanel class="w-full max-w-[90vw] max-h-[90vh] transform rounded-ds-card bg-ds-surface border border-ds-line flex flex-col overflow-hidden">
                <div class="px-6 pt-5 pb-4 border-b border-ds-line flex-shrink-0">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex min-w-0 items-center gap-3">
                      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-ds-md bg-ds-status-info-bg text-ds-status-info-text"><AlertTriangle class="h-[18px] w-[18px]" aria-hidden="true" /></span>
                      <DialogTitle class="min-w-0 truncate text-lg font-bold text-ds-ink">รายการผิดปกติ — รอตรวจสอบ</DialogTitle>
                    </div>
                    <BaseButton variant="ghost" size="sm" icon aria-label="ปิด" @click="closeExceptionsModal">
                      <X class="w-5 h-5" aria-hidden="true" />
                    </BaseButton>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="inline-flex bg-ds-surface border border-ds-line-strong rounded-ds-md p-0.5" role="group" aria-label="กรองตามสถานะ">
                      <button
                        v-for="opt in exceptionStatusOptions" :key="opt.value"
                        type="button"
                        :aria-pressed="exceptionStatusFilter === opt.value"
                        @click="exceptionStatusFilter = opt.value"
                        :class="['px-3 py-1.5 text-xs font-semibold rounded-ds-sm transition-colors',
                          exceptionStatusFilter === opt.value ? 'bg-ds-primary-tint text-ds-primary ring-1 ring-inset ring-ds-primary/30' : 'text-ds-ink-2 hover:text-ds-ink']"
                      >{{ opt.label }}</button>
                    </div>
                    <BaseSelect v-model="exceptionReasonFilter" :options="exceptionReasonOptions" aria-label="ประเภทรายการผิดปกติ" class="w-56" />
                    <BaseInput v-model="exceptionSearch" type="text" placeholder="ค้นหา CN, ชื่อ, จุดตรวจ..." aria-label="ค้นหารายการผิดปกติ" class="flex-1 min-w-[220px]" @input="onExceptionSearchInput">
                      <template #leading><SearchIcon class="h-4 w-4" aria-hidden="true" /></template>
                    </BaseInput>
                  </div>

                  <!-- แถบเลือกหลายรายการ — โผล่เฉพาะตอนดูใบที่ยังเปิดอยู่ เพราะปิดได้เฉพาะใบ PENDING -->
                  <div v-if="exceptionStatusFilter === 'PENDING' && selectableExceptionCount > 0" class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-ds-line">
                    <BaseCheckbox :model-value="allExceptionsSelected" @update:model-value="toggleSelectAllExceptions">
                      เลือกทั้งหน้า ({{ selectableExceptionCount }})
                    </BaseCheckbox>
                    <span class="text-xs text-ds-ink-3">
                      <template v-if="selectedExceptionIds.length">เลือกแล้ว {{ selectedExceptionIds.length }} · </template>ทั้งหมด {{ exceptionTotal }} รายการ
                    </span>
                    <div class="flex-1"></div>
                    <!-- ตัวอย่างค้างปิดเฉยๆ ไม่ได้ ต้องยกเลิกการรับ — แยกปุ่มตามชนิด ไม่รวมเป็นปุ่มเดียว -->
                    <template v-if="selectedExceptionIds.length">
                      <button v-if="selectedReceiptIds.length" type="button" class="text-[11px] px-2.5 py-1.5 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-danger/30 text-ds-danger bg-ds-surface hover:border-ds-danger hover:bg-ds-danger-soft" @click="bulkCancelReceipts('selected')">ยกเลิกการรับ {{ selectedReceiptIds.length }} ตัวอย่างที่เลือก</button>
                      <button v-if="selectedOtherIds.length" type="button" class="text-[11px] px-2.5 py-1.5 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-primary/30 text-ds-primary bg-ds-primary-tint hover:border-ds-primary/60 hover:bg-ds-primary-line/60" @click="bulkResolve('selected')">ปิด {{ selectedOtherIds.length }} รายการที่เลือก</button>
                    </template>
                    <template v-else>
                      <button v-if="receiptTotalInFilter > 0" type="button" class="text-[11px] px-2.5 py-1.5 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-danger/30 text-ds-danger bg-ds-surface hover:border-ds-danger hover:bg-ds-danger-soft" @click="bulkCancelReceipts('all')">ยกเลิกการรับทั้งหมด {{ receiptTotalInFilter }} ตัวอย่าง</button>
                      <button v-if="otherTotalInFilter > 0" type="button" class="text-[11px] px-2.5 py-1.5 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-danger/30 text-ds-danger bg-ds-status-danger-bg hover:border-ds-danger hover:bg-ds-danger-soft" @click="bulkResolve('all')">ปิดทั้งหมด {{ otherTotalInFilter }} รายการ</button>
                    </template>
                  </div>
                </div>

                <div class="flex-1 overflow-y-auto min-h-0 p-4">
                  <div v-if="exceptionsLoading" class="space-y-2">
                    <div v-for="n in 4" :key="n" class="h-16 bg-ds-sunken animate-pulse rounded-ds-md" />
                  </div>
                  <div v-else-if="exceptions.length === 0" class="py-10 flex flex-col items-center text-center">
                    <div class="w-10 h-10 bg-ds-status-success-bg rounded-ds-md flex items-center justify-center mx-auto mb-3">
                      <CheckCircle class="w-5 h-5 text-ds-status-success-text" />
                    </div>
                    <p class="text-sm font-semibold text-ds-ink">{{ exceptionSearch.trim() ? 'ไม่พบรายการที่ค้นหา' : exceptionStatusFilter === 'PENDING' ? 'ไม่มีรายการผิดปกติที่รอตรวจสอบ' : 'ไม่มีรายการในสถานะนี้' }}</p>
                  </div>
                  <!-- ตาราง — ทุกแถวมีช่องเดียวกัน (CN, ชื่อ, จุด, ประเภท, เวลา) กวาดตาทีละคอลัมน์ได้ แบบเดียวกับรายชื่อรายจุด -->
                  <div v-else class="rounded-ds-md border border-ds-line bg-ds-surface overflow-x-auto">
                    <table class="min-w-full divide-y divide-ds-line">
                      <thead>
                        <tr class="bg-ds-sunken">
                          <th v-if="exceptionStatusFilter === 'PENDING'" class="w-10 px-3 py-3"></th>
                          <th class="px-3 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">CN</th>
                          <th class="px-3 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">ชื่อ-นามสกุล</th>
                          <th class="px-3 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">จุดตรวจ</th>
                          <th class="px-3 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">ประเภท</th>
                          <th class="px-3 py-3 text-left text-sm font-semibold text-ds-ink-2">รายละเอียด</th>
                          <th class="px-3 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">สแกนโดย / เวลา</th>
                          <th v-if="exceptionStatusFilter !== 'PENDING'" class="px-3 py-3 text-left text-sm font-semibold text-ds-ink-2">ผลการจัดการ</th>
                          <th v-if="exceptionStatusFilter !== 'RESOLVED' && exceptionStatusFilter !== 'DISMISSED'" class="px-3 py-3 text-left text-sm font-semibold text-ds-ink-2 whitespace-nowrap">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-ds-line">
                        <tr v-for="ex in exceptions" :key="ex.id" class="hover:bg-ds-sunken transition-colors">
                          <td v-if="exceptionStatusFilter === 'PENDING'" class="px-3 py-3 align-top">
                            <BaseCheckbox v-if="isSelectableException(ex)" v-model="selectedExceptionIds" :value="ex.id" :aria-label="'เลือก ' + ex.barcode" />
                          </td>
                          <td class="px-3 py-3 align-top whitespace-nowrap">
                            <StatusBadge hue="sky">{{ ex.barcode }}</StatusBadge>
                          </td>
                          <!-- ไม่มีชื่อ = ประเภท "ไม่พบ CN" ซึ่งหาคนไข้ไม่เจอตั้งแต่แรก -->
                          <td class="px-3 py-3 align-top text-sm font-medium text-ds-ink whitespace-nowrap">{{ ex.patientName || '-' }}</td>
                          <td class="px-3 py-3 align-top text-sm text-ds-ink-2 whitespace-nowrap">{{ ex.station?.name || '-' }}</td>
                          <td class="px-3 py-3 align-top whitespace-nowrap">
                            <StatusBadge v-if="isAwaitingRegistration(ex)" tone="warning" class="!text-[10px]">รอทะเบียน</StatusBadge>
                            <StatusBadge v-else tone="danger" class="!text-[10px]">{{ reasonLabel(ex.reason) }}</StatusBadge>
                          </td>
                          <td class="px-3 py-3 align-top text-xs text-ds-ink-2 min-w-[260px]">{{ ex.message || '-' }}</td>
                          <td class="px-3 py-3 align-top text-xs whitespace-nowrap">
                            <p class="text-ds-ink-2">{{ ex.scannedByUser?.name || 'ตรวจพบโดยระบบ' }}</p>
                            <p class="text-ds-ink-3 mt-0.5">{{ formatDate(ex.scannedAt) }}</p>
                          </td>
                          <td v-if="exceptionStatusFilter !== 'PENDING'" class="px-3 py-3 align-top text-xs min-w-[200px]">
                            <template v-if="ex.status !== 'PENDING'">
                              <p class="font-semibold" :class="ex.status === 'RESOLVED' ? 'text-ds-status-success-text' : 'text-ds-ink-3'">
                                {{ ex.status === 'RESOLVED' ? 'แก้ไขแล้ว' : 'ไม่ใช่ปัญหา' }} · {{ ex.resolvedByUser?.name || 'ระบบ' }}
                              </p>
                              <p v-if="ex.resolutionNote" class="text-ds-ink-2 mt-0.5">{{ ex.resolutionNote }}</p>
                              <p class="text-ds-ink-3 mt-0.5">{{ formatDate(ex.resolvedAt) }}</p>
                            </template>
                            <span v-else class="text-ds-ink-3">-</span>
                          </td>
                          <td v-if="exceptionStatusFilter !== 'RESOLVED' && exceptionStatusFilter !== 'DISMISSED'" class="px-3 py-3 align-top whitespace-nowrap">
                            <div v-if="ex.status === 'PENDING'" class="flex items-center gap-1.5">
                              <!-- รอทะเบียน: Lab ทำส่วนของตัวเองจบแล้ว ปิดจากฝั่งนี้ไม่ได้ ต้องให้ทะเบียนตอบ -->
                              <button v-if="isAwaitingRegistration(ex)" type="button" disabled class="text-[11px] px-2.5 py-1 font-semibold rounded-ds-xs border border-ds-line text-ds-ink-3 bg-ds-sunken cursor-not-allowed">ส่งทะเบียนแล้ว</button>
                              <!-- ตัวอย่างค้าง: ปิดเฉยๆ ไม่ได้ (ตัวอย่างจะค้างเงียบ) — ยกเลิกการรับ หรือยิงตัวอย่างซ้ำเพื่อแจ้งทะเบียนใหม่
                                   ถ้าหน้างานยิงกลับมา / ทะเบียนยืนยัน ระบบปิดรายการให้เอง -->
                              <button v-else-if="ex.reason === 'CONFIRMED_BUT_SCAN_REMOVED'" type="button" class="text-[11px] px-2.5 py-1 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-danger/30 text-ds-danger bg-ds-surface hover:border-ds-danger hover:bg-ds-danger-soft" @click="cancelUnbackedReceipt({ exceptionId: ex.id }, ex.cn, ex.patientName)">ยกเลิกการรับ</button>
                              <template v-else>
                                <button type="button" class="text-[11px] px-2.5 py-1 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-status-success-dot/30 text-ds-status-success-text bg-ds-status-success-bg hover:border-ds-status-success-dot" @click="resolveException(ex, 'RESOLVED')">แก้ไขแล้ว</button>
                                <button type="button" class="text-[11px] px-2.5 py-1 font-semibold rounded-ds-xs border transition-all focus:outline-none border-ds-line text-ds-ink-3 bg-ds-surface hover:bg-ds-sunken" @click="resolveException(ex, 'DISMISSED')">ไม่ใช่ปัญหา</button>
                              </template>
                            </div>
                            <span v-else class="text-xs text-ds-ink-3">-</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Pagination footer — แบบเดียวกับรายชื่อรายจุด -->
                <BasePagination v-if="exceptionPagination.totalPages > 1" compact :page="exceptionPagination.page" :page-size="exceptionPagination.limit" :total="exceptionTotal" :total-pages="exceptionPagination.totalPages" :loading="exceptionsLoading" @update:page="exceptionPageChange" />
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
  FlaskConical, ScanLine, CheckCircle, X, Download, AlertTriangle,
  Clock as ClockIcon, ChevronDown, Search as SearchIcon,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseCombobox from '@/components/ui/BaseCombobox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import recheckScanService from '@/services/recheckScan.service.js'
import cnGroupService from '@/services/cngroup'
import { exportRecheck } from '@/services/excel.js'
import { subscribeToRecheckUpdate } from '@/services/socket.service.js'
import Swal from 'sweetalert2'

const LAB_STATION_STORAGE_KEY = 'labRecheckSelectedStationIds'

// ชื่อคนไข้/จุดตรวจถูกเอาไปต่อเป็น HTML ใน dialog — ต้อง escape กันเครื่องหมาย < > ในข้อมูลไปพังหน้า
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export default {
  name: 'LabRecheckView',
  components: {
    Listbox, ListboxButton, ListboxOptions, ListboxOption,
    HeadlessDialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild,
    VueDatePicker,
    FlaskConical, ScanLine, CheckCircle, X, Download, AlertTriangle,
    ClockIcon, ChevronDown, SearchIcon,
    BaseButton, BaseCheckbox, BaseCombobox, BaseInput, BasePagination, BaseSelect, StatusBadge,
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
      drilldownAwaitingRegistration: [],
      drilldownNeedsReview: [],
      drilldownApiSummary: {},
      drilldownPagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      recheckUpdateUnsubscribe: null,
      labStations: [],
      selectedStationIds: [],
      stationSearch: '',
      exceptionPendingCount: 0,
      // นับจากชุดเดียวกับที่เห็น (สถานะ + ประเภท + คำค้น) — ใช้แบ่งยอดบนปุ่ม "ทำทั้งหมด"
      exceptionFilteredCounts: { receipt: 0, awaitingRegistration: 0 },
      exceptionSearch: '',
      exceptionSearchTimeout: null,
      exceptionPagination: { page: 1, limit: 20, totalPages: 1 },
      showExceptionsModal: false,
      exceptionsLoading: false,
      exceptions: [],
      exceptionStatusFilter: 'PENDING',
      exceptionReasonFilter: 'all',
      exceptionTotal: 0,
      selectedExceptionIds: [],
      exceptionReasonOptions: [
        { value: 'all', label: 'ทุกประเภท' },
        { value: 'CN_NOT_FOUND', label: 'ไม่พบ CN' },
        { value: 'STATION_NOT_ALLOWED', label: 'ไม่มีรายการตรวจที่จุดนี้' },
        { value: 'CONFIRMED_BUT_SCAN_REMOVED', label: 'รับแล้วแต่ไม่มีการยิงรองรับ' },
        { value: 'SCAN_NOT_FOUND', label: 'แจ้งทะเบียน' },
      ],
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
    cnGroupOptions() {
      return this.cnGroups.map(g => ({ value: g.id, label: g.name, badge: g.code || '', hue: 'sky' }))
    },
    branchSelectOptions() {
      return [{ label: 'ทุกสาขา', value: '' }, ...this.branches.map(b => ({ label: b.name, value: b.id }))]
    },
    selectedReceiptIds() {
      const ids = new Set(this.selectedExceptionIds)
      return this.exceptions.filter(ex => ids.has(ex.id) && ex.reason === 'CONFIRMED_BUT_SCAN_REMOVED').map(ex => ex.id)
    },
    selectedOtherIds() {
      const receipt = new Set(this.selectedReceiptIds)
      return this.selectedExceptionIds.filter(id => !receipt.has(id))
    },
    // ยอดตามตัวกรองประเภทปัจจุบัน (ทั้งกลุ่ม ไม่ใช่แค่ที่โหลดมา) แยกเป็น ตัวอย่างค้าง / ประเภทอื่น
    receiptTotalInFilter() {
      return this.exceptionFilteredCounts.receipt
    },
    awaitingTotalInFilter() {
      return this.exceptionFilteredCounts.awaitingRegistration
    },
    // ปิดได้ = ทั้งหมดตามตัวกรอง ลบตัวอย่างค้าง (ต้องยกเลิกการรับ) และคำขอรอทะเบียน (ปิดไม่ได้)
    otherTotalInFilter() {
      return Math.max(0, this.exceptionTotal - this.receiptTotalInFilter - this.awaitingTotalInFilter)
    },
    selectedCNGroupId() { return this.selectedCNGroup?.id || null },
    selectedCNGroupName() { return this.selectedCNGroup?.name || null },
    isReady() {
      return this.mode === 'checkup' ? !!this.selectedCNGroupId : !!this.selectedDate
    },
    filteredLabStations() {
      const q = this.stationSearch.toLowerCase()
      if (!q) return this.labStations
      return this.labStations.filter(s => s.name.toLowerCase().includes(q) || String(s.id).includes(q))
    },
    selectedLabStations() {
      return this.labStations.filter(s => this.selectedStationIds.includes(s.id))
    },
    // แถวรอทะเบียนเลือกไม่ได้ — ไม่นับรวม ไม่งั้น "เลือกทั้งหน้า (1)" ทั้งที่ไม่มีอะไรให้เลือก
    selectableExceptionCount() {
      return this.exceptions.filter(ex => this.isSelectableException(ex)).length
    },
    allExceptionsSelected() {
      const selectable = this.exceptions.filter(ex => this.isSelectableException(ex))
      return selectable.length > 0 && selectable.every(ex => this.selectedExceptionIds.includes(ex.id))
    },
  },

  watch: {
    selectedCNGroup(newVal, oldVal) {
      if ((newVal?.id || null) === (oldVal?.id || null) || this.mode !== 'checkup') return
      this.resetSession()
      if (newVal) this.refreshRecheckData()
      this.subscribeRecheckRealtime(newVal?.id || null)
    },
    drilldownScanStatus() {
      this.drilldownPagination.page = 1
      this.loadDrilldownPatients()
    },
    exceptionStatusFilter() {
      this.exceptionPagination.page = 1
      if (this.showExceptionsModal) this.loadExceptions()
    },
    exceptionReasonFilter() {
      this.exceptionPagination.page = 1
      if (this.showExceptionsModal) this.loadExceptions()
    },
    selectedStationIds(ids) {
      // จำไว้ข้ามการรีเฟรช เพราะ Lab มักประจำจุดเดิมทั้งกะ — ใช้ key แยกจากหน้าสแกนจุดตรวจ
      // (หน้านั้นใช้ 'selectedStationIds' และล้างทิ้งทุกครั้งที่เปลี่ยน CNGroup ถ้าใช้ key เดียวกันจะตีกัน)
      try { localStorage.setItem(LAB_STATION_STORAGE_KEY, JSON.stringify(ids)) } catch { /* private mode */ }
      if (ids.length > 0) this.$nextTick(() => this.$refs.barcodeInput?.focus())
    },
  },

  async mounted() {
    await Promise.all([this.loadBranches(), this.loadCNGroups(), this.loadLabStations()])
    if (this.isReady) this.refreshRecheckData()
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
      // ต้อง return promise ของการดึง — dispatcher จะรู้ว่ายังดึงอยู่แล้วรวมสัญญาณที่ตามมาเป็นรอบเดียว
      // (เดิมไม่ return ทำให้ดึง summary ซ้อนกันทุกแท็บตอน Lab ยิงรัว จน summary + recheck ช้าเกิน 10 วิ)
      this.recheckUpdateUnsubscribe = subscribeToRecheckUpdate(cnGroupId, () => this.refreshRecheckData(true))
    },

    async loadCNGroups(search = '') {
      this.isLoadingCNGroups = true
      try {
        this.cnGroups = await cnGroupService.getAllForDropdown(search, 50, null, true)
      } catch { this.cnGroups = [] } finally { this.isLoadingCNGroups = false }
    },

    onCNGroupSearch(q) {
      this.cnGroupSearch = q || ''
      this.onCNGroupSearchInput()
    },
    onCNGroupPick(id) {
      this.selectedCNGroup = id == null ? null : (this.cnGroups.find(g => g.id === id) || this.selectedCNGroup)
    },
    onBranchPick(id) {
      this.selectedBranch = this.branches.find(b => b.id === id) || null
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
        html: `ดาวน์โหลดรายงาน Recheck LAB ของ "${esc(this.selectedCNGroupName)}" ใช่ไหม?
          <div class="mt-2 text-xs text-ds-ink-3">
            ไฟล์มี 2 ชีท (Recheck LAB, Recheck Exceptions) — ตอนปริ้น ถ้าต้องการปริ้นทั้ง 2 ชีท
            ให้เลือก "Print Entire Workbook" ในหน้าต่าง Print ของ Excel (ค่าเริ่มต้นจะปริ้นแค่ชีทที่เปิดอยู่)
          </div>`,
        showCancelButton: true,
        confirmButtonText: 'Export',
        cancelButtonText: 'ยกเลิก',
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
      if ((prev.needsReviewCount || 0) !== (next.needsReviewCount || 0)) this.markKeyUpdated('exceptions')
      const prevStations = new Map((prev.stations || []).map(s => [s.stationId, s]))
      for (const st of next.stations || []) {
        const old = prevStations.get(st.stationId)
        if (!old || old.total !== st.total || old.awaitingReceive !== st.awaitingReceive || old.received !== st.received || old.needsReview !== st.needsReview) {
          this.markKeyUpdated(`station-${st.stationId}`)
        }
      }
    },

    reasonLabel(reason) {
      return {
        CN_NOT_FOUND: 'ไม่พบ CN',
        STATION_NOT_FOUND: 'ไม่พบจุดตรวจ',
        NOT_LAB_STATION: 'ไม่ใช่จุด LAB',
        STATION_NOT_ALLOWED: 'ไม่มีรายการตรวจที่จุดนี้',
        SCAN_NOT_FOUND: 'แจ้งทะเบียน',
        CONFIRMED_BUT_SCAN_REMOVED: 'รับแล้วแต่ไม่มีการยิงรองรับ',
      }[reason] || reason
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

    /**
     * โหลดสรุป + ตัวนับรอตรวจสอบ — ต้องเรียงลำดับ ห้ามยิงพร้อมกัน
     *
     * loadSummary เป็นตัวที่ไปตรวจเจอ "รับแล้วแต่รายการถูกลบ" แล้วสร้าง ticket ให้ (syncRecheckConflicts
     * ทำงานอยู่ใน API สรุป) ส่วน loadExceptionPendingCount เป็นเควรีเบาๆ ที่วิ่งเสร็จก่อน
     * ถ้ายิงพร้อมกันตัวนับจะอ่านค่าตอนที่ ticket ยังไม่ถูกสร้าง → ขึ้น 0 ทั้งที่ควรมี ต้องรีเฟรชซ้ำถึงจะเห็น
     */
    async refreshRecheckData(silent = false) {
      await this.loadSummary(silent)
      await this.loadExceptionPendingCount()
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
      this.exceptionReasonFilter = 'all'
      this.exceptionSearch = ''
      this.exceptionPagination = { page: 1, limit: 20, totalPages: 1 }
      this.selectedExceptionIds = []
      this.loadExceptions()
    },

    closeExceptionsModal() {
      this.showExceptionsModal = false
      this.exceptions = []
      if (this.exceptionSearchTimeout) clearTimeout(this.exceptionSearchTimeout)
    },

    onExceptionSearchInput() {
      if (this.exceptionSearchTimeout) clearTimeout(this.exceptionSearchTimeout)
      this.exceptionSearchTimeout = setTimeout(() => {
        this.exceptionPagination.page = 1
        this.loadExceptions()
      }, 400)
    },

    exceptionPageChange(page) {
      this.exceptionPagination.page = page
      this.loadExceptions()
    },

    async loadExceptions() {
      if (!this.selectedCNGroupId) return
      this.exceptionsLoading = true
      this.selectedExceptionIds = []
      try {
        const res = await recheckScanService.getRecheckExceptions(this.selectedCNGroupId, {
          status: this.exceptionStatusFilter,
          reason: this.exceptionReasonFilter,
          search: this.exceptionSearch.trim(),
          page: this.exceptionPagination.page,
          limit: this.exceptionPagination.limit,
        })
        this.exceptions = res.data || []
        this.exceptionPendingCount = res.pendingCount || 0
        this.exceptionFilteredCounts = res.filteredCounts || { receipt: 0, awaitingRegistration: 0 }
        // ยอดรวมตามตัวกรอง (ไม่ใช่แค่หน้าที่เห็น) — ใช้บอกบนปุ่มว่า "ทำทั้งหมด" คือกี่ใบกันแน่
        this.exceptionTotal = res.pagination?.total ?? (res.data?.length || 0)
        this.exceptionPagination = { ...this.exceptionPagination, totalPages: res.pagination?.totalPages || 1 }
        // ลบรายการจนหน้าปัจจุบันว่าง (เช่นยกเลิกทั้งหน้าสุดท้าย) — ถอยกลับไปหน้าที่ยังมีข้อมูล
        if (this.exceptions.length === 0 && this.exceptionPagination.page > 1) {
          this.exceptionPagination.page = this.exceptionPagination.totalPages
          return this.loadExceptions()
        }
      } catch {
        this.exceptions = []
        this.exceptionTotal = 0
        this.exceptionFilteredCounts = { receipt: 0, awaitingRegistration: 0 }
      } finally {
        this.exceptionsLoading = false
      }
    },

    toggleSelectAllExceptions() {
      this.selectedExceptionIds = this.allExceptionsSelected
        ? []
        : this.exceptions.filter(ex => this.isSelectableException(ex)).map(ex => ex.id)
    },

    isAwaitingRegistration(ex) {
      return ex.status === 'PENDING' && ex.reason === 'SCAN_NOT_FOUND'
    },
    isSelectableException(ex) {
      return ex.status === 'PENDING' && !this.isAwaitingRegistration(ex)
    },

    /**
     * ปิดหลายรายการพร้อมกัน
     * @param {'selected'|'all'} scope - 'all' คือทุกใบที่ยัง PENDING ตามตัวกรองประเภทปัจจุบัน
     *   ไม่ใช่แค่ที่เห็นในหน้านี้ (เคสหลักคือโดนลบทีเป็นร้อย ต้องปิดรวดเดียวได้)
     */
    async bulkResolve(scope) {
      if (!this.selectedCNGroupId) return

      const reasonText = this.exceptionReasonOptions.find(o => o.value === this.exceptionReasonFilter)?.label || 'ทุกประเภท'
      const target = scope === 'all'
        ? `ทั้งหมด ${this.otherTotalInFilter} รายการ ประเภท "${reasonText}"`
        : `${this.selectedOtherIds.length} รายการที่เลือก`

      // ต้องเลือกประเภทการปิดเหมือนตอนกดทีละใบ ไม่งั้นจะตามสถิติย้อนหลังไม่ได้ว่าที่เตือนไปแม่นกี่ %
      // (ปิดทีละล็อตแปลว่าเป็นเรื่องเดียวกัน เลยถามครั้งเดียวต่อล็อตพอ)
      const result = await Swal.fire({
        icon: 'warning',
        title: 'ปิดหลายรายการพร้อมกัน',
        html: `
          <p class="text-sm">จะปิด <b>${esc(target)}</b></p>
          <p class="text-xs text-ds-ink-3 mt-1 mb-3">ย้อนกลับไม่ได้</p>
          <select id="bulk-status" class="swal2-select" style="display:flex;width:100%;margin:0 0 .5rem 0">
            <option value="RESOLVED">แก้ไขแล้ว — มีปัญหาจริง จัดการเรียบร้อยแล้ว</option>
            <option value="DISMISSED">ไม่ใช่ปัญหา — ไม่ได้มีปัญหาอะไรตั้งแต่แรก</option>
          </select>
          <textarea id="bulk-note" class="swal2-textarea" style="display:flex;width:100%;margin:0"
            placeholder="เหตุผล / สิ่งที่ตรวจสอบแล้ว"></textarea>
        `,
        showCancelButton: true,
        confirmButtonText: 'ปิดรายการ',
        cancelButtonText: 'ยกเลิก',
        focusConfirm: false,
        preConfirm: () => ({
          status: document.getElementById('bulk-status')?.value,
          note: document.getElementById('bulk-note')?.value?.trim() || '',
        }),
      })
      if (!result.isConfirmed) return

      try {
        const res = await recheckScanService.bulkResolveRecheckExceptions({
          cnGroupId: this.selectedCNGroupId,
          status: result.value.status,
          resolutionNote: result.value.note,
          ...(scope === 'all'
            ? { applyToAll: true, reason: this.exceptionReasonFilter, search: this.exceptionSearch.trim() }
            : { ids: this.selectedOtherIds }),
        })
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: res.message || 'ปิดรายการเรียบร้อย', timer: 1800, showConfirmButton: false })
        this.selectedExceptionIds = []
        await this.loadExceptions()
        await this.loadExceptionPendingCount()
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: err?.response?.data?.message || err?.message || 'เกิดข้อผิดพลาด' })
      }
    },

    /**
     * ยกเลิกการรับหลายตัวอย่างพร้อมกัน (รายการ "รับแล้วแต่ไม่มีการยิงรองรับ")
     * @param {'selected'|'all'} scope - 'all' คือทุกใบที่ค้างในกลุ่มนี้ ไม่ใช่แค่ที่เห็นในหน้านี้
     */
    async bulkCancelReceipts(scope) {
      if (!this.selectedCNGroupId) return
      const count = scope === 'all' ? this.receiptTotalInFilter : this.selectedReceiptIds.length

      const result = await Swal.fire({
        icon: 'warning',
        title: `ยกเลิกการรับ ${count} ตัวอย่าง?`,
        html: `<p class="text-xs text-ds-ink-3">ใช้เมื่อตัวอย่างผิดคน หรือคนไข้ไม่ได้ตรวจจุดนั้นจริง — ตัวอย่างที่ถูกคนให้ยิงซ้ำเพื่อแจ้งทะเบียนใหม่แทน</p>`,
        showCancelButton: true,
        confirmButtonText: 'ยกเลิกการรับ',
        cancelButtonText: 'ปิด',
      })
      if (!result.isConfirmed) return

      try {
        const res = await recheckScanService.bulkCancelUnbackedReceipts({
          cnGroupId: this.selectedCNGroupId,
          ...(scope === 'all' ? { applyToAll: true, search: this.exceptionSearch.trim() } : { ids: this.selectedReceiptIds }),
        })
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: res.message, timer: res.skipped ? undefined : 1800, showConfirmButton: !!res.skipped })
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: err?.response?.data?.message || 'เกิดข้อผิดพลาด' })
      }
      this.selectedExceptionIds = []
      await this.loadExceptions()
      if (this.drilldown) this.loadDrilldownPatients()
      this.refreshRecheckData(true)
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

    /**
     * Lab ยกเลิกการรับตัวอย่างที่ไม่มีการยิงรองรับ — ตัวอย่างผิดคน / คนไข้ไม่ได้ตรวจจริง
     * ปิดรายการผิดปกติและคำขอที่ค้างทะเบียนของตัวอย่างนี้ไปพร้อมกัน (ทำใน server)
     * @param target { confirmationId } จากรายชื่อรายจุด หรือ { exceptionId } จากรายการผิดปกติ
     */
    async cancelUnbackedReceipt(target, cn, name) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'ยกเลิกการรับตัวอย่างนี้?',
        html: `
          <div class="text-sm text-left">
            <p><b>${esc(cn || '-')}</b> ${esc(name || '')}</p>
            <p class="text-xs text-ds-ink-3 mt-3">ใช้เมื่อตัวอย่างผิดคน หรือคนไข้ไม่ได้ตรวจจุดนี้จริง — ถ้าตัวอย่างถูกคน ให้ยิงตัวอย่างอีกครั้งเพื่อแจ้งทะเบียนใหม่แทน</p>
          </div>`,
        showCancelButton: true,
        confirmButtonText: 'ยกเลิกการรับ',
        cancelButtonText: 'ปิด',
      })
      if (!result.isConfirmed) return

      try {
        const res = await recheckScanService.cancelUnbackedReceipt(target)
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: res.message || 'ยกเลิกการรับแล้ว', timer: 1800, showConfirmButton: false })
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: err?.response?.data?.message || 'เกิดข้อผิดพลาด' })
      }
      // รีโหลดทุกส่วนที่ตัวอย่างนี้ปรากฏ ทั้งสำเร็จและไม่สำเร็จ (ไม่สำเร็จมักเพราะสถานะเปลี่ยนไปแล้ว)
      if (this.showExceptionsModal) this.loadExceptions()
      if (this.drilldown) this.loadDrilldownPatients()
      this.refreshRecheckData(true)
    },

    switchMode(newMode) {
      if (newMode === this.mode) return
      this.mode = newMode
      this.resetSession()
      this.$nextTick(() => this.$refs.barcodeInput?.focus())
      if (this.isReady) this.refreshRecheckData()
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
      const nextStatus = station.awaitingReceive > 0 ? 'awaitingReceive' : 'received'
      const statusChanged = this.drilldownScanStatus !== nextStatus
      this.drilldownScanStatus = nextStatus
      this.drilldownPagination = { page: 1, limit: 20, total: 0, totalPages: 1 }
      this.drilldownPatients = []
      this.drilldownAwaitingRegistration = []
      this.drilldownNeedsReview = []
      this.drilldownApiSummary = {}
      // สถานะเปลี่ยนแล้ว watcher ของ drilldownScanStatus จะโหลดให้เอง — โหลดซ้ำตรงนี้จะยิงสองครั้ง
      if (!statusChanged) this.loadDrilldownPatients()
    },

    closeDrilldown() {
      this.drilldown = null
      this.drilldownSearch = ''
      this.drilldownPatients = []
      this.drilldownAwaitingRegistration = []
      this.drilldownNeedsReview = []
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
        this.drilldownAwaitingRegistration = res.awaitingRegistration || []
        this.drilldownNeedsReview = res.needsReview || []
        this.drilldownApiSummary = res.summary || {}
        this.drilldownPagination = { ...this.drilldownPagination, ...res.pagination }
      } catch {
        this.drilldownPatients = []
        this.drilldownAwaitingRegistration = []
        this.drilldownNeedsReview = []
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

    async loadLabStations() {
      try {
        const res = await recheckScanService.getLabStations()
        this.labStations = res.data || []
      } catch {
        this.labStations = []
      }

      // คืนค่าที่เลือกไว้ครั้งก่อน — ตัดจุดที่ถูกปิดใช้งาน/ลบไปแล้วทิ้ง ไม่งั้นจะมีจุดผีค้างอยู่ในที่เลือก
      try {
        const saved = JSON.parse(localStorage.getItem(LAB_STATION_STORAGE_KEY) || '[]')
        const valid = new Set(this.labStations.map(s => s.id))
        this.selectedStationIds = Array.isArray(saved) ? saved.filter(id => valid.has(id)) : []
      } catch {
        this.selectedStationIds = []
      }
    },

    removeStation(id) {
      this.selectedStationIds = this.selectedStationIds.filter(x => x !== id)
    },

    /**
     * ตรวจว่าบาร์โค้ดเป็นของจุดที่เลือกไว้ไหม — ทำฝั่งหน้าจอก่อนส่ง server (แบบหน้าสแกนจุดตรวจ)
     * @returns {string|null} ข้อความ error หรือ null ถ้าผ่าน
     */
    checkBarcodeStation(raw) {
      if (!raw.includes('.')) return `รูปแบบบาร์โค้ดไม่ถูกต้อง (ต้องเป็น ${this.mode === 'checkup' ? 'CN' : 'HN'}.StationID)`
      const stationId = parseInt(raw.split('.')[1])
      if (isNaN(stationId)) return 'รูปแบบบาร์โค้ดไม่ถูกต้อง: StationID ต้องเป็นตัวเลข'
      if (this.selectedStationIds.includes(stationId)) return null

      const scanned = this.labStations.find(s => s.id === stationId)
      const selectedNames = this.selectedLabStations.map(s => s.name).join(', ')
      return scanned
        ? `จุดตรวจไม่ตรงกัน: บาร์โค้ดนี้เป็นของ "${scanned.name}" แต่กำลังเลือก "${selectedNames}"`
        : `จุดตรวจไม่ตรงกัน: บาร์โค้ดนี้ไม่ใช่จุดตรวจ LAB (จุด ${stationId})`
    },

    async handleRecheck() {
      const raw = this.barcodeValue.trim()
      if (!raw || this.isScanning || !this.isReady) return

      const now = new Date()
      const time = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      // ยังไม่ส่ง server — ยิงผิดจุดคือความผิดพลาดของคนยิง ไม่ต้องบันทึกเป็นรายการผิดปกติให้รก
      const stationError = this.selectedStationIds.length === 0
        ? 'กรุณาเลือกจุดตรวจก่อนยิง'
        : this.checkBarcodeStation(raw)
      if (stationError) {
        this.history.unshift({ status: 'error', barcode: raw, time, message: stationError })
        this.lastStatus = 'error'
        this.playSound('error')
        this.barcodeValue = ''
        this.$nextTick(() => this.$refs.barcodeInput?.focus())
        return
      }

      this.isScanning = true

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
          // ตัวอย่างที่รับไว้ก่อนแล้วรอทะเบียน — บอกให้รู้ว่าไม่ต้องทำอะไรเพิ่ม ไม่ใช่ยิงซ้ำธรรมดา
          message: res.awaitingRegistration ? res.message : null,
        })

        if (isNew) {
          this.lastStatus = 'ok'
          this.sessionCount++
          this.playSound('success')
          // ไม่ดึง summary เองตรงนี้ — backend ส่ง recheck-update ทุกครั้งที่ยิง (รวมแท็บนี้) แล้วดึงผ่าน
          // dispatcher ที่กันซ้อนอยู่แล้ว (แบบเดียวกับหน้าสแกนจุดตรวจ) ถ้าดึงตรงด้วย ยิงรัวแล้วซ้อนกันเองในแท็บนี้
        } else {
          this.lastStatus = 'duplicate'
          this.playSound('duplicate')
        }
      } catch (err) {
        // backend ตอบ HTTP 400 เสมอตอน success:false → axios throw ตรงนี้เลย (ไม่ resolve เป็น
        // res.success:false ให้เช็คแบบปกติ)
        const data = err?.response?.data || {}
        const msg = data.message || null
        this.history.unshift({ status: 'error', barcode: raw, time, message: msg, station: data.station?.name })
        this.lastStatus = 'error'
        this.playSound('error')

        // หน้างานยังไม่ได้ยิง แต่คนไข้มีรายการตรวจจุดนี้จริง → เสนอให้รับไว้ก่อนแล้วแจ้งทะเบียนตาม
        // (ถ้าไม่มีรายการตรวจ backend จะไม่ส่งธงนี้มา เพราะเป็นเคสของมาผิดที่ต้องสืบก่อน)
        // ส่งแถวประวัติตัว reactive (history[0]) ไปด้วย จะได้เปลี่ยนเป็น "รับแล้ว" ในแถวเดิมถ้ากดรับ
        if (data.canRequestRegistrationScan) {
          await this.offerRequestRegistrationScan(data, this.history[0])
        }

        // อาจเพิ่งสร้าง RecheckException ไว้ — เช็คตัวเลขใหม่
        this.loadExceptionPendingCount()
      } finally {
        this.isScanning = false
        this.barcodeValue = ''
        this.$nextTick(() => this.$refs.barcodeInput?.focus())
      }
    },

    /**
     * หน้างานยังไม่ได้ยิง แต่ Lab ถือตัวอย่างอยู่ → เสนอให้รับไว้ก่อน แล้วแจ้งทะเบียนบันทึกการยิงตาม
     *
     * ต้องให้ Lab กดยืนยันเองทุกครั้ง — ถ้ารับให้อัตโนมัติ ยิงพลาด/ยิงผิดใบจะกลายเป็นรับของที่ไม่มีอยู่จริง
     * @param historyEntry แถวประวัติของการยิงครั้งนี้ ถ้ากดรับจะเปลี่ยนแถวเดิมเป็น "สำเร็จ" ไม่เพิ่มแถวซ้อน
     */
    async offerRequestRegistrationScan(data, historyEntry) {
      const patientName = data.patient
        ? `${data.patient.prefix || ''}${data.patient.first_name} ${data.patient.last_name}`.trim()
        : ''
      const stationName = data.station?.name || data.stationId
      // รับไว้แล้วแต่รายการหน้างานหายไปทีหลัง — ไม่ต้องรับซ้ำ แค่แจ้งทะเบียน
      const alreadyReceived = !!data.alreadyReceived

      const result = await Swal.fire({
        icon: 'question',
        title: alreadyReceived ? 'รับไว้แล้ว แต่ยังไม่มีการยิงจากหน้างาน' : 'หน้างานยังไม่ได้ยิงจุดนี้',
        html: `
          <div class="text-sm text-left">
            <p><b>${esc(data.cn)}</b> ${esc(patientName)}</p>
            <p class="mt-1">จุดตรวจ: <b>${esc(stationName)}</b></p>
            <p class="text-xs text-ds-ink-3 mt-3">
              ${alreadyReceived
                ? 'แจ้งทะเบียนให้บันทึกการยิงจุดนี้ตามไหม'
                : 'ถ้าตัวอย่างอยู่ในมือแล้ว กดรับไว้ได้เลย ระบบจะแจ้งทะเบียนให้บันทึกการยิงตาม'}
            </p>
          </div>`,
        showCancelButton: true,
        confirmButtonText: alreadyReceived ? 'แจ้งทะเบียน' : 'รับไว้ และแจ้งทะเบียน',
        cancelButtonText: 'ยกเลิก',
      })
      if (!result.isConfirmed) return

      try {
        const res = await recheckScanService.requestRegistrationScan({
          cnGroupId: this.selectedCNGroupId,
          cn: data.cn,
          stationId: data.stationId,
          barcode: data.barcode,
        })

        // ไม่เด้ง popup แจ้งผลอีกชั้น — กำลังยิงรัวๆ อยู่ ใช้เสียง + แถวประวัติบอกแทน
        if (historyEntry) {
          Object.assign(historyEntry, {
            status: 'ok',
            name: patientName || null,
            station: data.station?.name || null,
            message: res.message,
          })
        }
        if (res.receivedNow) {
          this.sessionCount++
          this.lastStatus = 'ok'
          this.playSound('success')
        }
        this.refreshRecheckData(true)
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: err?.response?.data?.message || 'เกิดข้อผิดพลาด' })
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
