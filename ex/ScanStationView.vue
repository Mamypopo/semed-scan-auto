<template>
  <!-- Audio elements for sound feedback -->
  <audio id="success-sound" src="/sounds/1-correct-2-46134.mp3" preload="auto"></audio>
  <audio id="error-sound" src="/sounds/2-wronganswer-37702.mp3" preload="auto"></audio>
  <audio id="duplicate-sound" src="/sounds/3-duplicate.mp3" preload="auto"></audio>
  <div class="space-y-6">
    <!-- CNGroup Info -->
    <div v-if="!hasSelectedCNGroup" class="bg-brand-warning-light border border-brand-warning/20 rounded-lg p-4">
      <p class="text-sm text-ui-text-brand-warning font-medium">
        ⚠️ กรุณาเลือก CN Group จาก Sidebar ก่อน
      </p>
      <p class="text-xs text-ui-text-brand-warning/80 mt-1">
        ระบบจะสแกนเฉพาะ Patient ใน CN Group ที่เลือก
      </p>
    </div>


    <!-- Header Summary Bar + Stats Cards (ซ่อนตอน offline) -->
    <div v-if="selectedCNGroupId && !isOffline" class="bg-white rounded-lg shadow-sm border border-ui-border-default p-3 mb-4">
      <!-- Loading Skeleton -->
      <template v-if="isLoadingSummary">
        <div class="space-y-3">
          <!-- Row 1: Header & Filters Skeleton -->
          <div class="flex flex-col lg:flex-row gap-3 justify-between">
            <div class="h-9 w-40 bg-ui-bg-tertiary animate-pulse rounded-lg"></div>
            <div class="flex gap-2 w-full lg:w-auto">
              <div class="h-9 w-full sm:w-64 bg-ui-bg-tertiary animate-pulse rounded-lg"></div>
              <div class="h-9 w-full sm:w-48 bg-ui-bg-tertiary animate-pulse rounded-lg"></div>
            </div>
          </div>
          <!-- Row 2: Stats Grid Skeleton -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <div v-for="n in 5" :key="'skeleton-stat-' + n" class="h-12 bg-ui-bg-tertiary animate-pulse rounded-lg">
            </div>
          </div>
        </div>
      </template>

      <!-- Summary Content -->
      <div v-else-if="dashboardSummary" class="flex flex-col gap-3">
        <!-- Row 1: Header & Filters & Tags -->
        <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <!-- Left: CNGroup & Tags -->
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <div class="flex items-center gap-2 h-10">
              <!-- CNGroup Badge -->
              <div
                class="flex items-center gap-2 px-2.5 py-1.5 bg-brand-info-light rounded-lg border border-brand-info/20 flex-shrink-0">
                <QrCode class="w-4 h-4 text-ui-text-brand-info" />
                <span class="text-sm font-semibold text-ui-text-brand-info truncate">{{ selectedCNGroupName || '-'
                }}</span>
              </div>
            </div>

            <!-- Selected Tags (Moved here!) -->
            <div v-if="(selectedCompanies.length > 0 || selectedUserIds.length > 0)" class="flex flex-wrap gap-1.5">
              <span v-for="company in selectedCompanies" :key="'c-' + company"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-secondary-light text-ui-text-brand-secondary text-xs rounded-lg border border-brand-secondary/20 font-semibold max-w-full"
                v-tooltip.bottom="company">
                <span class="break-words">{{ company }}</span>
                <button @click="toggleCompany(company)"
                  class="hover:text-ui-text-brand-error focus:outline-none transition-colors flex-shrink-0">
                  <X class="w-3 h-3" />
                </button>
              </span>
              <span v-for="userId in selectedUserIds" :key="'u-' + userId"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-accent-light text-ui-text-brand-accent text-xs rounded-lg border border-brand-accent/20 font-semibold">
                <span class="truncate max-w-[150px]">{{registeringUsers.find(u => u.id === userId)?.name || userId
                }}</span>
                <button @click="toggleUser(userId)"
                  class="hover:text-ui-text-brand-error focus:outline-none transition-colors flex-shrink-0">
                  <X class="w-3 h-3" />
                </button>
              </span>
            </div>
          </div>

          <!-- Right: Filters -->
          <div class="flex gap-2 flex-shrink-0 w-full lg:w-auto">
            <!-- Company Filter -->
            <div class="relative flex-1 min-w-0 lg:flex-none lg:w-auto lg:max-w-none">
              <Listbox v-model="selectedCompanies" multiple as="div" class="relative w-full lg:w-max lg:max-w-full"
                @update:model-value="handleCompanySelectionChange">
                <ListboxButton @click="loadCompaniesIfNeeded"
                  class="flex items-center gap-2 px-3 py-2 bg-white hover:bg-ui-bg-secondary border border-ui-border-default rounded-lg text-left cursor-pointer transition-colors w-full shadow-sm hover:shadow-md min-h-10 h-auto">
                  <span class="text-sm font-medium text-ui-text-primary flex-1 min-w-0 whitespace-normal break-words">
                    <template v-if="selectedCompanies.length > 0">
                      {{ selectedCompanies.length === 1 ? selectedCompanies[0] : `เลือก ${selectedCompanies.length}
                      บริษัท` }}
                    </template>
                    <template v-else>
                      <span class="text-ui-text-tertiary">กรองบริษัท</span>
                    </template>
                  </span>
                  <ChevronDown class="w-4 h-4 text-ui-text-tertiary transition-transform flex-shrink-0" />
                </ListboxButton>
                <transition enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95">
                  <ListboxOptions
                    class="absolute z-50 mt-1 min-w-full w-max max-w-[calc(100vw-1.5rem)] bg-white border border-ui-border-default rounded-lg shadow-xl focus:outline-none max-h-80 overflow-hidden flex flex-col right-0">
                    <!-- Search Input -->
                    <div class="p-2 border-b border-ui-border-default">
                      <div class="relative">
                        <SearchIcon
                          class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ui-text-tertiary" />
                        <input v-model.trim="companySearchQuery" type="text" placeholder="ค้นหาบริษัท..."
                          class="w-full pl-10 pr-4 py-2 text-xs border border-ui-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary-light focus:border-ui-border-focus bg-white text-ui-text-primary placeholder-ui-text-tertiary"
                          @click.stop @keydown.space.stop />
                      </div>
                    </div>
                    <!-- Company List -->
                    <div class="overflow-y-auto max-h-60 px-2 py-2">
                      <div v-if="filteredCompanies.length === 0 && !isLoadingCompanies && companySearchQuery"
                        class="px-3 py-4 text-center text-xs text-ui-text-tertiary">
                        ไม่พบผลการค้นหา
                      </div>
                      <div v-else-if="filteredCompanies.length === 0 && !isLoadingCompanies"
                        class="px-3 py-4 text-center text-xs text-ui-text-secondary">
                        ไม่พบข้อมูลบริษัท
                      </div>
                      <div v-else-if="isLoadingCompanies" class="px-3 py-4 text-center text-xs text-ui-text-secondary">
                        กำลังโหลด...
                      </div>
                      <ListboxOption v-for="company in filteredCompanies" :key="company" :value="company"
                        v-slot="{ active, selected }">
                        <li :class="[
                          'px-3 py-2 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors',
                          active ? 'bg-brand-primary-light text-ui-text-brand-primary' : 'text-ui-text-primary',
                        ]" v-tooltip.right="company">
                          <span class="flex-1 min-w-0 whitespace-normal break-words pr-2">{{ company }}</span>
                          <CheckCircle v-if="selected"
                            class="w-3.5 h-3.5 text-ui-text-brand-primary flex-shrink-0 ml-2" />
                        </li>
                      </ListboxOption>
                    </div>
                  </ListboxOptions>
                </transition>
              </Listbox>
            </div>

            <!-- User Filter -->
            <div class="relative flex-1 lg:flex-none lg:w-[220px]">
              <Listbox v-model="selectedUserIds" multiple as="div" class="relative"
                @update:model-value="handleUserSelectionChange">
                <ListboxButton
                  class="flex items-center gap-2 px-3 py-2 bg-white hover:bg-ui-bg-secondary border border-ui-border-default rounded-lg text-left cursor-pointer transition-colors w-full shadow-sm hover:shadow-md h-10">
                  <span class="text-sm font-medium text-ui-text-primary truncate flex-1">
                    <template v-if="selectedUserIds.length > 0">
                      {{selectedUserIds.length === 1
                        ? (registeringUsers.find(u => u.id === selectedUserIds[0])?.name || 'ผู้ลงทะเบียน')
                        : `เลือก ${selectedUserIds.length} คน`}}
                    </template>
                    <template v-else>
                      <span class="text-ui-text-tertiary">กรองผู้ลงทะเบียน</span>
                    </template>
                  </span>
                  <ChevronDown class="w-4 h-4 text-ui-text-tertiary transition-transform flex-shrink-0" />
                </ListboxButton>
                <transition enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95">
                  <ListboxOptions
                    class="absolute z-50 mt-1 w-full bg-white border border-ui-border-default rounded-lg shadow-xl focus:outline-none max-h-80 overflow-hidden flex flex-col right-0">
                    <!-- Search Input -->
                    <div class="p-2 border-b border-ui-border-default">
                      <div class="relative">
                        <SearchIcon
                          class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ui-text-tertiary" />
                        <input v-model.trim="userSearchQuery" type="text" placeholder="ค้นหาผู้ลงทะเบียน..."
                          class="w-full pl-10 pr-4 py-2 text-xs border border-ui-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary-light focus:border-ui-border-focus bg-white text-ui-text-primary placeholder-ui-text-tertiary"
                          @click.stop @keydown.space.stop />
                      </div>
                    </div>
                    <!-- User List -->
                    <div class="overflow-y-auto max-h-60 px-2 py-2">
                      <div v-if="filteredUsers.length === 0 && !isLoadingUsers && userSearchQuery"
                        class="px-3 py-4 text-center text-xs text-ui-text-tertiary">
                        ไม่พบผลการค้นหา
                      </div>
                      <div v-else-if="filteredUsers.length === 0 && !isLoadingUsers"
                        class="px-3 py-4 text-center text-xs text-ui-text-secondary">
                        ไม่พบข้อมูลผู้ลงทะเบียน
                      </div>
                      <div v-else-if="isLoadingUsers" class="px-3 py-4 text-center text-xs text-ui-text-secondary">
                        กำลังโหลด...
                      </div>
                      <ListboxOption v-for="user in filteredUsers" :key="user.id" :value="user.id"
                        v-slot="{ active, selected }">
                        <li :class="[
                          'px-3 py-2 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors',
                          active ? 'bg-brand-primary-light text-ui-text-brand-primary' : 'text-ui-text-primary',
                        ]">
                          <span class="truncate flex-1">{{ user.name }}</span>
                          <CheckCircle v-if="selected"
                            class="w-3.5 h-3.5 text-ui-text-brand-primary flex-shrink-0 ml-2" />
                        </li>
                      </ListboxOption>
                    </div>
                  </ListboxOptions>
                </transition>
              </Listbox>
            </div>
          </div>
        </div>

        <!-- Row 2: Stats Cards Grid (Compact) -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <!-- ทั้งหมด -->
          <button @click="openPatientModal('all')"
            class="flex items-center justify-between px-3 py-2.5 bg-brand-secondary-light hover:bg-brand-secondary-light/80 border border-brand-secondary/20 rounded-lg transition-all cursor-pointer group shadow-sm hover:shadow-md">
            <span class="text-xs font-medium text-ui-text-brand-secondary">ทั้งหมด</span>
            <span class="text-lg font-bold text-ui-text-brand-secondary">{{ dashboardSummary.totalPatients || 0
            }}</span>
          </button>

          <!-- ลงทะเบียน -->
          <button @click="openPatientModal('registered')"
            class="flex items-center justify-between px-3 py-2.5 bg-brand-success-light hover:bg-brand-success-light/80 border border-brand-success/20 rounded-lg transition-all cursor-pointer group shadow-sm hover:shadow-md">
            <span class="text-xs font-medium text-ui-text-brand-success">ลงทะเบียน</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ui-text-brand-success">{{ dashboardSummary.registered || 0 }}</span>
              <span class="text-[10px] text-ui-text-brand-success/80">({{ dashboardSummary.registrationPercentage || 0
              }}%)</span>
            </div>
          </button>

          <!-- ไม่ลงทะเบียน -->
          <button @click="openPatientModal('unregistered')"
            class="flex items-center justify-between px-3 py-2.5 bg-brand-warning-light hover:bg-brand-warning-light/80 border border-brand-warning/20 rounded-lg transition-all cursor-pointer group shadow-sm hover:shadow-md">
            <span class="text-xs font-medium text-ui-text-brand-warning">ไม่ลงทะเบียน</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold text-ui-text-brand-warning">{{ dashboardSummary.unregistered || 0 }}</span>
              <span class="text-[10px] text-ui-text-brand-warning/80">
                ({{ dashboardSummary.totalPatients > 0 ? Math.round(((dashboardSummary.unregistered || 0) /
                  dashboardSummary.totalPatients) * 100) : 0 }}%)
              </span>
            </div>
          </button>

          <!-- ตรวจพิเศษ -->
          <button @click="openPatientModal('special_checkup')"
            class="flex items-center justify-between px-3 py-2.5 bg-brand-accent-light hover:bg-brand-accent-light/80 border border-brand-accent/20 rounded-lg transition-all cursor-pointer group shadow-sm hover:shadow-md">
            <span class="text-xs font-medium text-ui-text-brand-accent">ตรวจพิเศษ</span>
            <span class="text-lg font-bold text-ui-text-brand-accent">{{ dashboardSummary.specialCheckupCount || 0
            }}</span>
          </button>

          <!-- สแกน -->
          <div
            class="flex items-center justify-between px-3 py-2.5 bg-brand-primary-light border border-brand-primary/20 rounded-lg shadow-sm">
            <span class="text-xs font-medium text-ui-text-brand-primary">สแกน</span>
            <span class="text-lg font-bold text-ui-text-brand-primary">{{ dashboardSummary.totalScans || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="!isLoadingSummary && !dashboardSummary"
        class="flex items-center justify-center py-8 text-sm text-ui-text-secondary bg-ui-bg-secondary/30 rounded-lg border border-dashed border-ui-border-default">
        ไม่สามารถโหลดข้อมูลได้
      </div>
    </div>

    <!-- Dashboard (ซ่อนตอน offline) -->
    <ScanDashboard ref="scanDashboardRef" v-if="selectedCNGroupId && !isOffline" :cnGroupId="selectedCNGroupId"
      :stationId="selectedStations.length === 1 ? selectedStations[0].id : null" :companies="selectedCompanies"
      :created-by-user-ids="selectedUserIds" @open-station-modal="openStationModal" />

    <!-- Offline: ไม่มีข้อมูลสำรอง warning -->
    <div v-if="selectedCNGroupId && isOffline && !isOfflineReady"
      class="bg-brand-warning-light border border-brand-warning/20 rounded-lg p-4 text-sm text-ui-text-brand-warning font-medium">
      ไม่มีข้อมูลสำรอง — ไม่สามารถสแกนออฟไลน์ได้ กรุณากดปุ่ม "สำรองข้อมูล Offline" ก่อน
    </div>

    <!-- Offline: รายการสแกนออฟไลน์ -->
    <OfflineScanList
      ref="offlineScanListRef"
      v-if="selectedCNGroupId && isOffline && isOfflineReady"
      :cn-group-id="selectedCNGroupId"
    />

    <!-- Scan Input & Result Section (2 Columns) -->
    <div v-if="selectedCNGroupId" class="flex flex-col md:flex-row gap-4">
      <!-- ส่วนซ้าย: Scan Input Section -->
      <div class="w-full md:w-[45%]">
        <div class="bg-white rounded-lg shadow-sm border border-ui-border-default hover:shadow-md transition-all">
          <!-- Header Section -->
          <div class="px-5 py-4 border-b border-ui-border-default">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-ui-bg-tertiary border border-ui-border-default rounded-lg flex items-center justify-center">
                  <ScanBarcode class="text-brand-secondary w-6 h-6" />
                </div>
                <h2 class="text-lg font-semibold text-ui-text-brand-primary">เลือกจุดตรวจ & สแกน</h2>
              </div>

              <!-- Offline chip + Auto Scan Toggle -->
              <div class="flex items-center gap-2">
                <!-- Offline: warning badge -->
                <span v-if="isOffline && isOfflineReady" class="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-warning-light text-brand-warning-dark text-[10px] font-semibold whitespace-nowrap">
                  <WifiOff class="w-3 h-3 flex-shrink-0" />
                  ออฟไลน์ · {{ offlineCacheMeta?.memberCount?.toLocaleString() }} คน
                </span>
                <span v-else-if="isOffline && !isOfflineReady" class="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-warning-light text-brand-warning-dark text-[10px] font-semibold whitespace-nowrap">
                  <WifiOff class="w-3 h-3 flex-shrink-0" />
                  ออฟไลน์ · ไม่มีข้อมูลสำรอง
                </span>
                <!-- Online + pending sync -->
                <button v-else-if="isOnline && offlinePendingCount > 0" @click="handleSync" :disabled="isSyncing"
                  class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap bg-brand-primary-light text-brand-primary border border-brand-primary/20 hover:bg-brand-primary/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                  <Loader2 v-if="isSyncing" class="w-3 h-3 animate-spin" />
                  <RefreshCw v-else class="w-3 h-3" />
                  {{ isSyncing ? 'กำลัง sync...' : `${offlinePendingCount} รอ sync` }}
                </button>
                <!-- Online + ready chip -->
                <button v-else-if="isOnline && isOfflineReady" @click="handlePrepareOffline" :disabled="offlinePrepareModal.show"
                  class="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold whitespace-nowrap transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="offlinePrepareModal.show ? 'bg-ui-bg-secondary border-ui-border-default text-ui-text-tertiary'
                    : isCacheStale ? 'bg-brand-warning-light border-brand-warning-soft/60 text-brand-warning-dark hover:bg-brand-warning-soft/20'
                    : 'bg-brand-success-light border-brand-success-soft/60 text-brand-success-dark hover:bg-brand-success-soft/20'">
                  <Loader2 v-if="offlinePrepareModal.show" class="w-3 h-3 animate-spin" />
                  <AlertTriangle v-else-if="isCacheStale" class="w-3 h-3" />
                  <CheckCircle2 v-else class="w-3 h-3" />
                  <span v-if="offlinePrepareModal.show">กำลังโหลด...</span>
                  <span v-else-if="isCacheStale">เก่า {{ cacheAgeText }} · อัพเดท</span>
                  <span v-else>สำรองข้อมูลแล้ว · {{ offlineCacheMeta?.memberCount?.toLocaleString() }} คน<template v-if="offlineCacheSizeMb"> · {{ offlineCacheSizeMb }}</template> · {{ offlineCachedAtFormatted }}</span>
                </button>
                <!-- Online + no cache -->
                <button v-else-if="isOnline" @click="handlePrepareOffline" :disabled="offlinePrepareModal.show"
                  class="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold whitespace-nowrap transition-all bg-ui-bg-primary border-ui-border-default text-ui-text-tertiary hover:border-brand-primary hover:text-brand-primary disabled:opacity-50 disabled:cursor-not-allowed">
                  <Loader2 v-if="offlinePrepareModal.show" class="w-3 h-3 animate-spin" />
                  <WifiOff v-else class="w-3 h-3" />
                  {{ offlinePrepareModal.show ? 'กำลังโหลด...' : 'สำรอง Offline' }}
                </button>

                <div class="w-px h-4 bg-ui-border-default"></div>

                <span
                  class="text-xs font-bold transition-colors duration-300 whitespace-nowrap w-12 text-right select-none tracking-wide"
                  :class="isAutoMode ? 'text-brand-success' : 'text-brand-warning'">
                  {{ isAutoMode ? 'AUTO' : 'MANUAL' }}
                </span>

                <label class="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" v-model="isAutoMode" class="sr-only peer" />
                  <div
                    class="w-11 h-6 rounded-full shadow-inner transition-colors duration-300 bg-brand-warning peer-checked:bg-brand-success peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-success-light peer-focus:ring-offset-1 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-transform after:duration-300 peer-checked:after:translate-x-full">
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Content Section -->
          <div class="p-6 space-y-6 ">
            <!-- เลือกจุดตรวจ Section -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-ui-text-primary">
                  เลือกจุดตรวจ
                </h3>
                <button v-if="selectedStations.length > 0" @click="clearStationSelection"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ui-text-brand-error bg-brand-error-light rounded-lg hover:bg-brand-error-light/80 focus:outline-none focus:ring-2 focus:ring-brand-error-light transition-colors shadow-sm"
                  title="ล้างการเลือกจุดตรวจ">
                  <X class="h-3 w-3" />
                  ล้าง
                </button>
              </div>

              <div class="relative">
                <!-- ปุ่มแสดงเมนูเลือกจุดตรวจ -->
                <button @click="showStationSelector = !showStationSelector"
                  class="w-full flex items-center justify-between px-3 py-2.5 border border-ui-border-default rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-brand-primary-light focus:border-brand-primary hover:border-brand-primary transition-all shadow-sm hover:shadow-md"
                  type="button">
                  <div class="flex items-center gap-3">
                    <div v-if="selectedStations.length > 0"
                      class="w-6 h-6 rounded-full flex items-center justify-center bg-brand-secondary text-white text-xs font-bold">
                      {{ selectedStations.length }}
                    </div>
                    <div v-else
                      class="w-6 h-6 rounded-full flex items-center justify-center bg-ui-bg-tertiary text-ui-text-tertiary text-xs">
                      ?
                    </div>
                    <div class="text-left">
                      <span class="block text-sm font-medium text-ui-text-primary">
                        <template v-if="selectedStations.length === 0">
                          กรุณาเลือกจุดตรวจ
                        </template>
                        <template v-else>
                          เลือก {{ selectedStations.length }} จุดตรวจ
                        </template>
                      </span>
                    </div>
                  </div>
                  <ChevronDown class="h-4 w-4 text-ui-text-tertiary transition-transform duration-200"
                    :class="{ 'rotate-180': showStationSelector }" />
                </button>

                <!-- Dropdown -->
                <div v-if="showStationSelector"
                  class="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-xl border border-ui-border-default overflow-hidden">
                  <!-- ช่องค้นหา -->
                  <div class="p-2 border-b border-ui-border-default">
                    <div class="relative">
                      <input v-model="stationSearch" type="text" placeholder="ค้นหาจุดตรวจ..."
                        class="w-full pl-8 pr-3 py-2.5 text-sm border border-ui-border-default rounded-lg shadow-sm bg-white text-ui-text-primary placeholder-ui-text-tertiary focus:border-ui-border-focus focus:ring-2 focus:ring-brand-primary-light focus:outline-none transition-all hover:shadow-md" />
                      <div class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                        <SearchIcon class="h-4 w-4 text-ui-text-tertiary" />
                      </div>
                    </div>
                  </div>

                  <!-- รายการจุดตรวจ -->
                  <div class="max-h-48 overflow-y-auto">
                    <div v-if="filteredStations.length === 0" class="p-3 text-center text-ui-text-secondary text-sm">
                      ไม่พบจุดตรวจที่ค้นหา
                    </div>
                    <div v-for="station in filteredStations" :key="station.id" @click="toggleStationSelection(station)"
                      class="p-2.5 hover:bg-brand-primary-light/20 cursor-pointer border-b border-ui-border-default flex items-center gap-3 transition-colors"
                      :class="{
                        'bg-brand-primary-light/30': selectedStations.some((s) => s.id === station.id),
                      }">
                      <input type="checkbox" :checked="selectedStations.some((s) => s.id === station.id)"
                        class="h-4 w-4 text-brand-primary focus:ring-brand-primary-light border-ui-border-default rounded"
                        @click.stop @change="toggleStationSelection(station)" />
                      <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" :class="selectedStations.some((s) => s.id === station.id)
                        ? 'bg-brand-secondary text-white'
                        : 'bg-ui-bg-tertiary text-ui-text-tertiary'
                        ">
                        {{ station.id }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-ui-text-primary truncate">
                          {{ station.name }}
                        </div>
                        <div v-if="station.isSpecial" class="text-xs text-ui-text-secondary flex items-center gap-1.5">
                          <span class="w-2 h-2 bg-brand-success rounded-full"></span>
                          <span class="truncate">
                            {{ station.specialType || 'จุดตรวจพิเศษ' }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- จุดตรวจที่เลือก -->
              <div v-if="selectedStations.length > 0" class="mt-3">
                <div class="flex flex-wrap gap-1.5">
                  <div v-for="station in selectedStations" :key="station.id"
                    class="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-secondary-light text-ui-text-brand-secondary rounded-lg text-xs border border-brand-secondary/20 hover:bg-brand-secondary-light/80 transition-colors font-semibold">
                    <div
                      class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-brand-secondary text-white">
                      {{ station.id }}
                    </div>
                    <span class="truncate max-w-[100px]">{{ station.name }}</span>
                    <button @click="toggleStationSelection(station)"
                      class="text-ui-text-brand-success hover:text-ui-text-brand-error focus:outline-none transition-colors">
                      <X class="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Divider -->
            <div class="border-t border-ui-border-default"></div>

            <!-- Barcode Input -->
            <div>
              <label class="block text-sm font-semibold text-ui-text-primary mb-2">สแกนบาร์โค้ด</label>
              <div class="relative">
                <input ref="barcodeInputRef" v-model="barcodeInput" @keyup.enter="handleScan" type="text"
                  placeholder="กรอกหรือสแกนบาร์โค้ด..."
                  class="w-full pl-10 pr-10 py-2.5 text-sm border border-ui-border-default rounded-lg shadow-sm bg-white text-ui-text-primary placeholder-ui-text-tertiary focus:border-ui-border-focus focus:ring-2 focus:ring-brand-primary-light focus:outline-none transition-all hover:shadow-md"
                  :disabled="isScanning || (!isAutoMode && selectedStations.length === 0)" />
                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <QrCode class="h-4 w-4 text-ui-text-tertiary" />
                </div>
                <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button v-if="barcodeInput" type="button"
                    class="text-ui-text-tertiary hover:text-ui-text-brand-error focus:outline-none transition-colors"
                    @click="barcodeInput = ''" v-tooltip.right="'ล้างข้อมูล'">
                    <X class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p class="mt-2 text-xs text-ui-text-secondary flex items-center gap-1.5">
                <Info class="h-3.5 w-3.5 text-ui-text-tertiary" />
                บาร์โค้ดต้องมีรูปแบบ CN.STATION_ID เช่น 680010001.1
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ส่วนขวา: Result Card -->
      <div class="w-full md:w-[55%]">
        <div v-if="lastScanResult && lastScanResult.success && lastScanResult.patient"
          class="bg-white rounded-lg shadow-sm border border-ui-border-default h-full overflow-hidden">
          <!-- Status Bar -->
          <div class="h-1.5 bg-brand-primary"></div>

          <!-- Patient Card Content -->
          <div class="p-4 md:p-5">
            <!-- Profile Section -->
            <div class="flex flex-col md:flex-row md:items-start gap-3 md:gap-4 mb-4">
              <!-- Avatar -->
              <div class="relative flex-shrink-0 self-center md:self-start">
                <div
                  class="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-ui-bg-tertiary flex items-center justify-center shadow-md">
                  <User class="w-8 h-8 md:w-10 md:h-10 text-ui-text-tertiary" />
                </div>
                <div
                  class="absolute -bottom-1 -right-1 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center shadow-sm bg-brand-success text-white border-2 border-white">
                  <CheckCircle class="h-4 w-4 md:h-5 md:w-5" />
                </div>
              </div>

              <!-- Name & Badges -->
              <div class="flex-1 min-w-0 flex flex-col items-center md:items-start">
                <div class="flex flex-col md:flex-row md:items-center w-full md:gap-3">
                  <h3
                    class="text-lg md:text-xl font-bold text-ui-text-brand-primary truncate text-center md:text-left w-full md:w-auto">
                    {{ lastScanResult.patient.prefix || '' }} {{ lastScanResult.patient.first_name }} {{
                      lastScanResult.patient.last_name }}
                  </h3>
                  <div class="flex flex-wrap justify-center md:justify-start gap-1.5 mt-1 md:mt-0">
                    <span
                      class="bg-brand-success-light text-ui-text-brand-success border border-brand-success/20 px-2 py-0.5 rounded-lg text-xs font-semibold">
                      สแกนสำเร็จ
                    </span>
                    <span v-if="lastScanResult.station"
                      class="bg-brand-accent-light text-ui-text-brand-accent border border-brand-accent/20 px-2 py-0.5 rounded-lg text-xs font-semibold">
                      {{ lastScanResult.station.name }}
                    </span>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-2.5">

                  <div v-if="lastScanResult.membership?.cn"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-primary-light/20 border border-brand-primary/20 rounded-md">
                    <Hash class="w-3.5 h-3.5 text-brand-primary" />
                    <span class="text-xs text-ui-text-secondary">CN:</span>
                    <span class="text-sm font-semibold text-brand-primary tracking-wide">{{ lastScanResult.membership.cn
                    }}</span>
                  </div>

                  <div v-if="lastScanResult.patient.citizenId"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ui-bg-secondary border border-ui-border-default rounded-md">
                    <IdCard class="w-3.5 h-3.5 text-ui-text-secondary" />
                    <span class="text-xs text-ui-text-secondary">เลขบัตรฯ:</span>
                    <span class="text-sm font-medium text-ui-text-primary tracking-wide">{{
                      lastScanResult.patient.citizenId
                    }}</span>
                  </div>

                </div>
              </div>
            </div>

            <!-- Employee Details Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <!-- Employee Code -->
              <div v-if="lastScanResult.membership?.employeeCode"
                class="flex items-start gap-3 p-3 rounded-lg hover:bg-ui-bg-secondary transition">
                <div
                  class="w-10 h-10 bg-brand-secondary-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <User class="w-5 h-5 text-ui-text-brand-secondary" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-ui-text-primary">{{ lastScanResult.membership.employeeCode }}</p>
                  <p class="text-xs text-ui-text-tertiary mt-1">รหัสพนักงาน</p>
                </div>
              </div>
              <!-- Department -->
              <div v-if="lastScanResult.membership?.department"
                class="flex items-start gap-3 p-3 rounded-lg hover:bg-ui-bg-secondary transition">
                <div class="w-10 h-10 bg-brand-accent-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 class="w-5 h-5 text-ui-text-brand-accent" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-ui-text-primary">{{ lastScanResult.membership.department }}</p>
                  <p class="text-xs text-ui-text-tertiary mt-1">แผนก</p>
                </div>
              </div>
              <!-- Position -->
              <div v-if="lastScanResult.membership?.position"
                class="flex items-start gap-3 p-3 rounded-lg hover:bg-ui-bg-secondary transition">
                <div class="w-10 h-10 bg-brand-warning-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase class="w-5 h-5 text-ui-text-brand-warning" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-ui-text-primary">{{ lastScanResult.membership.position }}</p>
                  <p class="text-xs text-ui-text-tertiary mt-1">ตำแหน่ง</p>
                </div>
              </div>
              <!-- Company -->
              <div v-if="lastScanResult.membership?.companyName"
                class="flex items-start gap-3 p-3 rounded-lg hover:bg-ui-bg-secondary transition">
                <div class="w-10 h-10 bg-brand-info-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building class="w-5 h-5 text-ui-text-brand-info" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-ui-text-primary">{{ lastScanResult.membership.companyName }}</p>
                  <p class="text-xs text-ui-text-tertiary mt-1">บริษัท</p>
                </div>
              </div>
              <!-- Program -->
              <div v-if="lastScanResult.membership?.program"
                class="flex items-start gap-3 p-3 rounded-lg hover:bg-ui-bg-secondary transition">
                <div class="w-10 h-10 bg-brand-success-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <CodeIcon class="w-5 h-5 text-ui-text-brand-success" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-ui-text-primary">{{ lastScanResult.membership.program }}</p>
                  <p class="text-xs text-ui-text-tertiary mt-1">โปรแกรม</p>
                </div>
              </div>
            </div>

            <!-- Scan Status Message -->
            <div class="rounded-lg p-4 border-l-4 bg-brand-success-light border-brand-success/80">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3 flex-1">
                  <CheckCircle class="h-5 w-5 text-ui-text-brand-success flex-shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-ui-text-primary leading-relaxed">
                      {{ lastScanResult.message }}
                    </p>
                    <p v-if="lastScanResult.station" class="text-xs text-ui-text-secondary mt-1">
                      จุดตรวจ: {{ lastScanResult.station.name }}
                    </p>
                  </div>
                </div>
                <!-- Cancel Button -->
                <button v-if="lastScanResult.scanItemId && !lastScanResult.isCancelled" @click="handleCancelScan"
                  class="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-ui-text-brand-error bg-brand-error-light border border-brand-error/20 rounded-lg hover:bg-brand-error-light/80 transition-colors flex items-center gap-1.5 shadow-sm">
                  <X class="h-3.5 w-3.5" />
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else
          class="bg-white rounded-lg shadow-sm border border-ui-border-default hover:shadow-md transition-all h-full flex items-center justify-center p-8">
          <div class="text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-lg bg-ui-bg-tertiary flex items-center justify-center">
              <QrCode class="w-8 h-8 text-ui-text-tertiary" />
            </div>
            <p class="text-sm text-ui-text-secondary font-medium">ยังไม่มีการสแกน</p>
            <p class="text-xs text-ui-text-tertiary mt-1">ผลลัพธ์การสแกนจะแสดงที่นี่</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Patient List Modal -->
    <ScanPatientListModal :isOpen="showPatientModal" :cnGroupId="selectedCNGroupId" :status="patientModalStatus"
      :companies="selectedCompanies" :created-by-user-ids="selectedUserIds" @close="showPatientModal = false" />

    <!-- Station Patient List Modal -->
    <StationPatientListModal :isOpen="showStationModal" :cnGroupId="selectedCNGroupId" :stationId="selectedStationId"
      :stationName="selectedStationName" :examType="selectedStationExamType" :companies="selectedCompanies"
      :created-by-user-ids="selectedUserIds" @close="showStationModal = false" @remark-saved="handleRemarkSaved"
      @remark-deleted="handleRemarkDeleted" />

    <!-- Offline Prepare Modal -->
    <OfflinePrepareModal
      :show="offlinePrepareModal.show"
      :progress="offlinePrepareModal.progress"
      :status="offlinePrepareModal.status"
      :error-message="offlinePrepareModal.errorMessage"
      :cache-size="offlinePrepareModal.cacheSize"
      :cached-at-formatted="offlinePrepareModal.cachedAtFormatted"
      :member-count="offlinePrepareModal.memberCount"
      @close="offlinePrepareModal.show = false"
    />
  </div>
</template>

<script>
import Swal from 'sweetalert2'
import {
  CheckCircle,
  QrCode,
  ChevronDown,
  Search as SearchIcon,
  X,
  Info,
  User,
  Building2,
  Briefcase,
  Building,
  ScanBarcode,
  Hash,
  IdCard,
  Code as CodeIcon,
  WifiOff,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw
} from 'lucide-vue-next'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'
import ScanDashboard from './components/ScanDashboard.vue'
import ScanPatientListModal from './components/ScanPatientListModal.vue'
import StationPatientListModal from './components/StationPatientListModal.vue'

import OfflinePrepareModal from '@/views/registration/components/OfflinePrepareModal.vue'
import OfflineScanList from './components/OfflineScanList.vue'
import scanService from '@/services/scan.js'
import stationService from '@/services/station.js'
import { getScanSummary } from '@/services/dashboard.service.js'
import { useCNGroupStore } from '@/stores/cnGroup'
import { useAuthStore } from '@/stores/auth'
import { getCacheMeta, getStationsOffline, getMemberByCn, buildOfflineCache } from '@/services/offline/cache.service.js'
import { enqueueScan, getPendingCount, flushQueue, retryErrorQueue } from '@/services/offline/sync.service.js'
import db from '@/services/offline/db.js'

export default {
  name: 'ScanStationView',
  components: {
    ScanDashboard,
    ScanPatientListModal,
    StationPatientListModal,

    OfflinePrepareModal,
    OfflineScanList,
    CheckCircle,
    QrCode,
    ChevronDown,
    SearchIcon,
    X,
    Info,
    User,
    Building2,
    Briefcase,
    Building,
    CodeIcon,
    ScanBarcode,
    Listbox,
    ListboxButton,
    ListboxOptions,
    ListboxOption,
    Hash,
    IdCard,
    WifiOff,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
  },
  setup() {
    const cnGroupStore = useCNGroupStore()
    const authStore = useAuthStore()
    return { cnGroupStore, authStore }
  },
  data() {
    return {
      barcodeInput: '',
      selectedStations: [],
      stations: [],
      stationSearch: '',
      showStationSelector: false,
      isAutoMode: false,
      isScanning: false,
      lastScanResult: null,
      dashboardSummary: null,
      isLoadingSummary: false,
      selectedCompanies: [],
      allCompanies: [],
      isLoadingCompanies: false,
      companySearchQuery: '',
      showPatientModal: false,
      patientModalStatus: null,
      showStationModal: false,
      selectedStationId: null,
      selectedStationName: '',
      selectedStationExamType: null,
      selectedUserIds: [],
      registeringUsers: [],
      isLoadingUsers: false,
      userSearchQuery: '',
      // --- Offline state ---
      isOnline: navigator.onLine,
      isSyncing: false,
      offlinePendingCount: 0,
      offlineCacheMeta: null,
      offlinePrepareModal: { show: false, progress: 0, status: 'loading', errorMessage: null, cacheSize: null, cachedAtFormatted: null, memberCount: 0 },
    }
  },
  computed: {
    hasSelectedCNGroup() {
      return this.cnGroupStore.hasSelectedCNGroup
    },
    selectedCNGroupId() {
      return this.cnGroupStore.selectedCNGroup
    },
    selectedCNGroupName() {
      return this.cnGroupStore.selectedCNGroupName
    },
    filteredStations() {
      if (!this.stationSearch) return this.stations

      const query = this.stationSearch.toLowerCase()
      return this.stations.filter(station =>
        station.name.toLowerCase().includes(query) ||
        String(station.id).includes(query)
      )
    },
    filteredCompanies() {
      if (!this.companySearchQuery.trim()) {
        return this.allCompanies
      }
      const query = this.companySearchQuery.toLowerCase()
      return this.allCompanies.filter((company) =>
        company.toLowerCase().includes(query)
      )
    },
    filteredUsers() {
      if (!this.userSearchQuery.trim()) {
        return this.registeringUsers
      }
      const query = this.userSearchQuery.toLowerCase()
      return this.registeringUsers.filter((user) =>
        user.name?.toLowerCase().includes(query)
      )
    },
    isOffline() { return !this.isOnline },
    isOfflineReady() { return !!this.offlineCacheMeta?.cachedAt },
    offlineCachedAtFormatted() {
      if (!this.offlineCacheMeta?.cachedAt) return null
      const d = new Date(this.offlineCacheMeta.cachedAt)
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    },
    offlineCacheSizeMb() {
      const bytes = this.offlineCacheMeta?.sizeBytes
      if (!bytes) return null
      return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
    },
    isCacheStale() {
      if (!this.offlineCacheMeta?.cachedAt) return false
      return Date.now() - new Date(this.offlineCacheMeta.cachedAt).getTime() > 8 * 60 * 60 * 1000
    },
    cacheAgeText() {
      if (!this.offlineCacheMeta?.cachedAt) return null
      const hours = Math.floor((Date.now() - new Date(this.offlineCacheMeta.cachedAt).getTime()) / 3600000)
      return hours < 1 ? null : `${hours} ชม.`
    },
  },
  watch: {
    selectedCNGroupId: {
      handler(newVal) {
        if (newVal) {
          this.loadSummary()
          this.loadStations().then(() => {
            // โหลดการเลือกจุดตรวจจาก localStorage
            this.loadSelectedStationFromStorage()
          })
          // Load companies เมื่อเปลี่ยน CNGroup
          this.loadCompanies()
          this.loadRegisteringUsers()
          this.refreshOfflineMeta()
        } else {
          this.stations = []
          this.selectedStations = []
          this.dashboardSummary = null
          this.selectedCompanies = []
          this.allCompanies = []
          this.companySearchQuery = ''
          this.selectedUserIds = []
          this.registeringUsers = []
          this.userSearchQuery = ''
          this.offlineCacheMeta = null
          this.offlinePendingCount = 0
          // ลบการเลือกจาก localStorage เมื่อเปลี่ยน CNGroup
          localStorage.removeItem('selectedStationIds')
        }
      },
      immediate: true
    },
    selectedStations: {
      handler(newVal) {
        // บันทึกการเลือกจุดตรวจลง localStorage
        if (newVal && newVal.length > 0) {
          localStorage.setItem('selectedStationIds', JSON.stringify(newVal.map((s) => s.id)))
        } else {
          localStorage.removeItem('selectedStationIds')
        }
      },
      deep: true
    },
    isAutoMode(newVal) {
      if (newVal) {
        Swal.fire({
          icon: 'info',
          title: 'เปิดโหมดสแกนอัตโนมัติ',
          text: 'ระบบจะเลือกจุดตรวจจากบาร์โค้ดอัตโนมัติ',
          toast: true,
          position: 'bottom-right',
          timer: 2000,
          showConfirmButton: false
        })
      } else {
        Swal.fire({
          icon: 'info',
          title: 'ปิดโหมดสแกนอัตโนมัติ',
          text: 'กลับไปเป็นโหมดสแกนแบบ Manual',
          toast: true,
          position: 'bottom-right',
          timer: 2000,
          showConfirmButton: false
        })
      }
    }
  },
  mounted() {
    this.$nextTick(() => {
      if (this.$refs.barcodeInputRef) this.$refs.barcodeInputRef.focus()
    })
    this._onOnline = async () => {
      this.isOnline = true
      await this.refreshOfflineMeta()
      if (this.offlinePendingCount > 0) this.handleSync()
    }
    this._onOffline = () => { this.isOnline = false }
    window.addEventListener('online', this._onOnline)
    window.addEventListener('offline', this._onOffline)
    this.refreshOfflineMeta()
  },
  beforeUnmount() {
    window.removeEventListener('online', this._onOnline)
    window.removeEventListener('offline', this._onOffline)
  },
  methods: {
    async loadSummary() {
      if (!this.selectedCNGroupId) {
        this.dashboardSummary = null
        return
      }

      this.isLoadingSummary = true
      try {
        const response = await getScanSummary(this.selectedCNGroupId, this.selectedCompanies, this.selectedUserIds)
        if (response && response.success && response.data && response.data.summary) {
          this.dashboardSummary = response.data.summary
        } else {
          console.warn('Invalid response format:', response)
          this.dashboardSummary = null
        }
      } catch (error) {
        console.error('Error loading scan summary:', error)
        this.dashboardSummary = null
      } finally {
        this.isLoadingSummary = false
      }
    },
    async loadCompanies() {
      if (!this.selectedCNGroupId || this.isLoadingCompanies) return

      this.isLoadingCompanies = true
      try {
        const response = await scanService.getCompanies(this.selectedCNGroupId)
        if (response.success && response.data) {
          this.allCompanies = response.data
        }
      } catch (error) {
        console.error('Error loading companies:', error)
        this.allCompanies = []
      } finally {
        this.isLoadingCompanies = false
      }
    },
    loadCompaniesIfNeeded() {
      // Load companies เมื่อเปิด dropdown ครั้งแรก
      if (this.allCompanies.length === 0 && this.selectedCNGroupId && !this.isLoadingCompanies) {
        this.loadCompanies()
      }
    },
    handleCompanySelectionChange() {
      // Reload summary เมื่อเปลี่ยน company filter
      if (this.selectedCNGroupId) {
        this.loadSummary()
      }
    },
    toggleCompany(company) {
      // Remove company from selectedCompanies
      const index = this.selectedCompanies.indexOf(company)
      if (index > -1) {
        this.selectedCompanies.splice(index, 1)
        // Reload summary after removing company
        if (this.selectedCNGroupId) {
          this.loadSummary()
        }
      }
    },
    async loadRegisteringUsers() {
      if (!this.selectedCNGroupId || this.isLoadingUsers) return
      this.isLoadingUsers = true
      try {
        const response = await scanService.getRegisteringUsers(this.selectedCNGroupId)
        this.registeringUsers = response?.data || []
      } catch (error) {
        console.error('Error loading registering users:', error)
        this.registeringUsers = []
      } finally {
        this.isLoadingUsers = false
      }
    },
    handleUserSelectionChange() {
      if (this.selectedCNGroupId) {
        this.loadSummary()
      }
    },
    toggleUser(userId) {
      const index = this.selectedUserIds.indexOf(userId)
      if (index > -1) {
        this.selectedUserIds.splice(index, 1)
        if (this.selectedCNGroupId) {
          this.loadSummary()
        }
      }
    },
    openPatientModal(status) {
      this.patientModalStatus = status
      this.showPatientModal = true
    },
    openStationModal(station) {
      this.selectedStationId = station.id
      this.selectedStationName = station.name
      this.selectedStationExamType = station.examType || null
      this.showStationModal = true
    },

    async loadStations() {
      if (!this.selectedCNGroupId) return
      if (this.isOffline) {
        this.stations = await getStationsOffline() || []
        return
      }
      try {
        const response = await stationService.getActiveScannedByCnGroup(this.selectedCNGroupId)
        this.stations = response || []
      } catch (error) {
        console.error('Error loading stations:', error)
        // fallback to cache on network error
        const cached = await getStationsOffline()
        if (cached?.length) this.stations = cached
      }
    },
    toggleStationSelection(station) {
      const index = this.selectedStations.findIndex((s) => s.id === station.id)
      if (index === -1) {
        this.selectedStations.push(station)
      } else {
        this.selectedStations.splice(index, 1)
      }
    },
    clearStationSelection() {
      this.selectedStations = []
      localStorage.removeItem('selectedStationIds')
    },
    loadSelectedStationFromStorage() {
      if (!this.selectedCNGroupId) return

      try {
        const selectedStationIds = localStorage.getItem('selectedStationIds')
        if (selectedStationIds) {
          const ids = JSON.parse(selectedStationIds)
          // ตรวจสอบว่า stations เหล่านี้ยังอยู่ในรายการหรือไม่
          this.selectedStations = this.stations.filter((station) => ids.includes(station.id))
          // ถ้ามีบาง station ที่ไม่พบ ให้อัปเดต localStorage
          if (this.selectedStations.length !== ids.length) {
            if (this.selectedStations.length > 0) {
              localStorage.setItem('selectedStationIds', JSON.stringify(this.selectedStations.map((s) => s.id)))
            } else {
              localStorage.removeItem('selectedStationIds')
            }
          }
        }
      } catch (error) {
        console.error('Error loading selected stations from storage:', error)
        localStorage.removeItem('selectedStationIds')
      }
    },
    getInitials(patient) {
      if (!patient) return '?'
      const first = patient.first_name?.[0] || ''
      const last = patient.last_name?.[0] || ''
      return (first + last).toUpperCase() || '?'
    },
    async handleCancelScan() {
      if (!this.lastScanResult?.scanItemId) return

      const result = await Swal.fire({
        title: 'ยืนยันการยกเลิก',
        text: 'คุณต้องการยกเลิกการสแกนนี้หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444', // brand-error
        cancelButtonColor: '#6B7280', // ui-text-secondary
        confirmButtonText: 'ยกเลิกการสแกน',
        cancelButtonText: 'ยกเลิก'
      })

      if (result.isConfirmed) {
        try {
          const response = await scanService.cancelScan(this.lastScanResult.scanItemId)
          if (response.success) {
            // อัปเดตสถานะ
            this.lastScanResult.isCancelled = true
            this.lastScanResult.message = response.message || 'ยกเลิกการสแกนสำเร็จ'

            this.playSuccessSound()
            Swal.fire({
              icon: 'success',
              title: 'สำเร็จ',
              text: response.message,
              toast: true,
              position: 'bottom-right',
              timer: 2000,
              showConfirmButton: false
            })
          } else {
            this.playErrorSound()
            Swal.fire({
              icon: 'error',
              title: 'เกิดข้อผิดพลาด',
              text: response.message
            })
          }
        } catch (error) {
          console.error('Cancel scan error:', error)
          this.playErrorSound()
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: error.response?.data?.message || 'ไม่สามารถยกเลิกการสแกนได้'
          })
        }
      }
    },
    parseBarcodeInput(barcode) {
      let cn = barcode
      let stationId = null
      if (barcode.includes('.')) {
        const parts = barcode.split('.')
        cn = parts[0]
        stationId = parseInt(parts[1])
        if (isNaN(stationId)) throw new Error('รูปแบบบาร์โค้ดไม่ถูกต้อง: Station ID ต้องเป็นตัวเลข')
      } else if (!this.isAutoMode) {
        if (this.selectedStations.length === 0) throw new Error('กรุณาเลือกจุดตรวจอย่างน้อย 1 จุด')
        throw new Error('กรุณาระบุ Station ID ในบาร์โค้ด (CN.STATION_ID) หรือเลือกจุดตรวจ')
      } else {
        throw new Error('กรุณาระบุ Station ID ในบาร์โค้ด (CN.STATION_ID)')
      }
      return { cn, stationId }
    },
    async handleScan() {
      if (!this.barcodeInput.trim()) return
      if (!this.selectedCNGroupId) {
        Swal.fire({ icon: 'warning', title: 'กรุณาเลือก CNGroup', text: 'กรุณาเลือก CNGroup ก่อนสแกน' })
        return
      }

      this.isScanning = true
      this.lastScanResult = null

      try {
        const barcode = this.barcodeInput.trim()
        const { cn, stationId } = this.parseBarcodeInput(barcode)

        // ตรวจสอบว่า Station ID จากบาร์โค้ดอยู่ในรายการที่เลือกหรือไม่ (ถ้าไม่ใช่ Auto Mode)
        if (!this.isAutoMode && stationId) {
          const isStationSelected = this.selectedStations.some((s) => s.id === stationId)
          if (!isStationSelected) {
            const scannedStation = this.stations.find((s) => s.id === stationId)
            const errorMessage = scannedStation
              ? `จุดตรวจไม่ตรงกัน: บาร์โค้ดนี้เป็นของจุดตรวจ "${scannedStation.name}" แต่คุณกำลังเลือกจุดตรวจ "${this.selectedStations.map((s) => s.name).join(', ')}"`
              : `จุดตรวจไม่ตรงกัน: ไม่พบจุดตรวจที่มี ID: ${stationId}`
            throw new Error(errorMessage)
          }
        }

        // ─── Offline path ──────────────────────────────────────────
        if (this.isOffline) {
          await this.handleScanOffline(cn, stationId)
          return
        }
        // ─── Online path ───────────────────────────────────────────

        let result = await scanService.scanCheckpoint(cn, stationId, this.selectedCNGroupId)

        // มีหมายเหตุจุดตรวจ → ถามก่อนบันทึก scan
        if (result.success && result.scanRecorded === false && result.hasStationRemark) {
          const r = result.stationRemark
          const remarkText = [r.reason?.title, r.remark].filter(Boolean).join(': ')
          this.playErrorSound()

          const confirmed = await Swal.fire({
            icon: 'warning',
            title: 'มีหมายเหตุจุดตรวจ',
            html: `<div>${remarkText || 'ผู้ป่วยรายนี้มีหมายเหตุที่จุดตรวจนี้'}</div><div class="text-sm text-gray-400 mt-1">ยืนยันเพื่อสแกนและลบหมายเหตุออก</div>`,
            showCancelButton: true,
            confirmButtonText: 'ยืนยันและสแกน',
            cancelButtonText: 'ยกเลิก',
            reverseButtons: true,
            focusConfirm: false,
            focusCancel: false,
            didOpen: () => {
              if (document.activeElement) {
                document.activeElement.blur()
              }
            }
          })
          if (!confirmed.isConfirmed) {
            this.barcodeInput = ''
            setTimeout(() => { if (this.$refs.barcodeInputRef) this.$refs.barcodeInputRef.focus() }, 300)
            return
          }
          // ยืนยันแล้ว → สแกนจริงพร้อมลบหมายเหตุ
          result = await scanService.scanCheckpoint(cn, stationId, this.selectedCNGroupId, true)
        }

        if (result.success) {
          this.lastScanResult = {
            success: true,
            message: result.message,
            patient: result.patient,
            membership: result.membership,
            station: result.station,
            scanItemId: result.scanItem?.id || null,
            isCancelled: result.scanItem?.isCancelled || false,
            isNewScan: result.isNewScan || false,
            hasStationRemark: result.hasStationRemark || false,
            stationRemark: result.stationRemark || null
          }

          if (result.isNewScan === false) {
            this.playDuplicateScanSound()
            Swal.fire({
              icon: 'warning',
              title: 'สแกนซ้ำ',
              toast: true,
              position: 'bottom-right',
              text: result.message,
              width: '450px',
              showConfirmButton: false,
              timer: 1500
            })
          } else {
            this.playSuccessSound()
            Swal.fire({
              icon: 'success',
              toast: true,
              position: 'bottom-right',
              title: 'สแกนสำเร็จ',
              width: '450px',
              text: result.message,
              showConfirmButton: false,
              timer: 1500
            })
          }

          // Clear input and reload dashboard
          this.barcodeInput = ''

          // Auto focus quickly after success
          setTimeout(() => {
            if (this.$refs.barcodeInputRef) {
              this.$refs.barcodeInputRef.focus()
            }
          }, 50)
        } else {
          this.barcodeInput = ''
          this.playErrorSound()
          Swal.fire({
            icon: 'warning',
            title: 'สแกนไม่สำเร็จ',
            text: result.message || 'ไม่สามารถสแกนได้',
            confirmButtonText: 'ตกลง'
          })

          this.lastScanResult = {
            success: false,
            message: result.message
          }
        }
      } catch (error) {
        console.error('Scan error:', error)

        const errorMessage = error.response?.data?.message || error.message || 'เกิดข้อผิดพลาดในการสแกน'

        this.barcodeInput = ''
        this.playErrorSound()
        Swal.fire({
          icon: 'error',
          title: 'สแกนไม่สำเร็จ',
          text: errorMessage,
          confirmButtonText: 'ตกลง'
        })

        this.lastScanResult = {
          success: false,
          message: errorMessage
        }
      } finally {
        this.isScanning = false
      }
    },
    playSuccessSound() {
      const audio = document.getElementById('success-sound')
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(err => console.error('Error playing success sound:', err))
      }
    },
    playErrorSound() {
      const audio = document.getElementById('error-sound')
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(err => console.error('Error playing error sound:', err))
      }
    },
    playDuplicateScanSound() {
      const audio = document.getElementById('duplicate-sound')
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(err => console.error('Error playing duplicate sound:', err))
      }
    },
    handleRemarkSaved() {
      // Refresh ScanDashboard เมื่อบันทึกหมายเหตุสำเร็จ
      if (this.$refs.scanDashboardRef) {
        this.$refs.scanDashboardRef.loadDashboard()
      }
    },
    handleRemarkDeleted() {
      // Refresh ScanDashboard เมื่อลบหมายเหตุสำเร็จ
      if (this.$refs.scanDashboardRef) {
        this.$refs.scanDashboardRef.loadDashboard()
      }
    },
    async refreshOfflineMeta() {
      if (!this.selectedCNGroupId) return
      this.offlineCacheMeta = await getCacheMeta(this.selectedCNGroupId)
      this.offlinePendingCount = await getPendingCount(this.authStore?.user?.id, 'SCAN')
    },
    async handlePrepareOffline() {
      this.offlinePrepareModal = { show: true, progress: 0, status: 'loading', errorMessage: null, cacheSize: null, cachedAtFormatted: null, memberCount: 0 }
      try {
        const result = await buildOfflineCache(this.selectedCNGroupId, (p) => { this.offlinePrepareModal.progress = p })
        this.offlinePrepareModal.status = 'done'
        this.offlinePrepareModal.memberCount = result.memberCount
        this.offlinePrepareModal.cachedAtFormatted = new Date(result.cachedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        this.offlinePrepareModal.cacheSize = result.sizeBytes < 1048576
          ? `${(result.sizeBytes / 1024).toFixed(0)} KB`
          : `${(result.sizeBytes / 1048576).toFixed(1)} MB`
        await this.refreshOfflineMeta()
        await this.loadStations()
      } catch (e) {
        this.offlinePrepareModal.status = 'error'
        this.offlinePrepareModal.errorMessage = e.message || 'เกิดข้อผิดพลาด'
      }
    },
    async handleScanOffline(cn, stationId) {
      if (!this.isOfflineReady) {
        this.playErrorSound()
        Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูลสำรอง', text: 'กรุณากดสำรองข้อมูล Offline ก่อนใช้งานในโหมดออฟไลน์' })
        this.barcodeInput = ''
        setTimeout(() => { if (this.$refs.barcodeInputRef) this.$refs.barcodeInputRef.focus() }, 300)
        return
      }

      // 1. ค้นหา member จาก CN
      const member = await getMemberByCn(this.selectedCNGroupId, cn)
      if (!member) {
        this.playErrorSound()
        Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูลผู้ป่วย', text: `ไม่พบ CN: ${cn} ในข้อมูลสำรอง` })
        this.barcodeInput = ''
        setTimeout(() => { if (this.$refs.barcodeInputRef) this.$refs.barcodeInputRef.focus() }, 300)
        return
      }

      // 2. ดึง station info (user เลือกมาแล้ว ไม่ต้องเช็ค isActive ซ้ำ)
      const station = this.stations.find((s) => s.id === stationId)
      if (!station) {
        this.playErrorSound()
        Swal.fire({ icon: 'warning', title: 'ไม่พบจุดตรวจ', text: `ไม่พบจุดตรวจ ID: ${stationId} ในข้อมูลสำรอง` })
        this.barcodeInput = ''
        setTimeout(() => { if (this.$refs.barcodeInputRef) this.$refs.barcodeInputRef.focus() }, 300)
        return
      }

      // 3. เช็คว่ามี registration
      const hasOnlineReg = !!member.registrationId
      const hasOfflineReg = (await db.offlineQueue
        .where('membershipId').equals(member.membershipId)
        .and((q) => q.type === 'REGISTRATION' && q.status !== 'error')
        .count()) > 0
      if (!hasOnlineReg && !hasOfflineReg) {
        this.playErrorSound()
        Swal.fire({ icon: 'warning', title: 'ยังไม่ได้ลงทะเบียน', text: `CN: ${cn} ยังไม่ได้ลงทะเบียน กรุณาลงทะเบียนก่อนเข้ารับการตรวจ` })
        this.barcodeInput = ''
        setTimeout(() => { if (this.$refs.barcodeInputRef) this.$refs.barcodeInputRef.focus() }, 300)
        return
      }

      // 4. เช็ค station อยู่ใน exam items
      const allowedStationIds = new Set(
        (member.examItems || []).flatMap((e) => e.medicalItem?.stationToMedicalItems || []).map((s) => s.stationId)
      )
      if (!allowedStationIds.has(stationId)) {
        this.playErrorSound()
        Swal.fire({ icon: 'warning', title: 'ไม่อยู่ในรายการตรวจ', text: `จุดตรวจ "${station.name}" ไม่อยู่ในรายการตรวจของ CN: ${cn}` })
        this.barcodeInput = ''
        setTimeout(() => { if (this.$refs.barcodeInputRef) this.$refs.barcodeInputRef.focus() }, 300)
        return
      }

      // 5. เช็ค duplicate ใน offline queue
      const isDuplicate = (await db.offlineQueue
        .where('cnGroupId').equals(this.selectedCNGroupId)
        .and((q) => q.type === 'SCAN' && q.cn === cn && q.stationId === stationId && q.status !== 'error')
        .count()) > 0

      // บันทึก offline queue
      const clientId = await enqueueScan({
        cnGroupId: this.selectedCNGroupId,
        membershipId: member.membershipId,
        cn: member.cn || cn,
        stationId,
        stationName: station.name,
        firstName: member.patient?.first_name || null,
        lastName: member.patient?.last_name || null,
        userId: this.authStore?.user?.id || null,
      })

      this.offlinePendingCount++

      this.lastScanResult = {
        success: true,
        message: isDuplicate ? `สแกนซ้ำ (ออฟไลน์) — จะ sync เมื่อกลับออนไลน์` : `บันทึกออฟไลน์แล้ว — จะ sync เมื่อกลับออนไลน์`,
        patient: member.patient,
        membership: {
          cn: member.cn,
          employeeCode: member.employeeCode,
          department: member.department,
          position: member.position,
          companyName: member.companyName,
        },
        station,
        scanItemId: null,
        isCancelled: false,
        isNewScan: !isDuplicate,
        _offline: true,
        _clientId: clientId,
      }

      if (isDuplicate) {
        this.playDuplicateScanSound()
        Swal.fire({ icon: 'warning', toast: true, position: 'bottom-right', title: 'สแกนซ้ำ (ออฟไลน์)', text: `CN ${member.cn} · ${station.name}`, showConfirmButton: false, timer: 1500, width: '450px' })
      } else {
        this.playSuccessSound()
        Swal.fire({ icon: 'success', toast: true, position: 'bottom-right', title: 'บันทึกออฟไลน์แล้ว', text: `CN ${member.cn} · ${station.name}`, showConfirmButton: false, timer: 1500, width: '450px' })
      }

      this.barcodeInput = ''
      this.$refs.offlineScanListRef?.load()
      setTimeout(() => { if (this.$refs.barcodeInputRef) this.$refs.barcodeInputRef.focus() }, 50)
    },
    async handleSync() {
      if (this.isSyncing || !this.isOnline) return
      this.isSyncing = true
      const userId = this.authStore?.user?.id
      try {
        const results = await flushQueue((done, total) => { this.offlinePendingCount = total - done }, userId, 'SCAN')
        await this.refreshOfflineMeta()
        this.$refs.offlineScanListRef?.load()
        this.$refs.scanDashboardRef?.loadDashboard()

        if (results.success > 0 || results.failed > 0) {
          const mkRow = (i) => {
            const t = i.createdAt ? new Date(i.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''
            const name = [i.firstName, i.lastName].filter(Boolean).join(' ')
            return `<div class="flex items-start gap-2 py-1 border-b border-gray-100 last:border-0">
              <span class="font-semibold text-gray-700 whitespace-nowrap">CN ${i.cn || '-'}</span>
              <div class="flex-1 min-w-0">
                <div class="text-gray-700 truncate">${name || '-'}</div>
                ${i.stationName ? `<div class="text-gray-400 text-[10px]">${i.stationName}</div>` : ''}
              </div>
              ${t ? `<span class="text-gray-400 whitespace-nowrap text-[10px]">${t} น.</span>` : ''}
            </div>`
          }

          const successSection = results.success > 0 ? `
            <div class="mb-3">
              <div class="flex items-center gap-1.5 mb-1.5">
                <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                <span class="text-xs font-semibold text-green-700">สำเร็จ ${results.success} รายการ</span>
              </div>
              <div class="max-h-48 overflow-y-auto bg-green-50 border border-green-100 rounded-lg px-3 py-1 text-xs text-gray-600">
                ${results.items.map(mkRow).join('')}
              </div>
            </div>` : ''

          const errorSection = results.failed > 0 ? `
            <div>
              <div class="flex items-center gap-1.5 mb-1.5">
                <span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                <span class="text-xs font-semibold text-red-600">ล้มเหลว ${results.failed} รายการ</span>
              </div>
              <div class="max-h-48 overflow-y-auto bg-red-50 border border-red-100 rounded-lg px-3 py-1 text-xs text-gray-600">
                ${results.errors.map((e) => mkRow({ ...e, createdAt: null }) + `<div class="text-red-500 text-[10px] pb-1">${e.error}</div>`).join('')}
              </div>
            </div>` : ''

          const hasErrors = results.failed > 0
          const { isConfirmed } = await Swal.fire({
            icon: hasErrors ? 'warning' : 'success',
            title: 'Sync เสร็จสิ้น',
            html: `<div class="text-left">${successSection}${errorSection}</div>`,
            showCancelButton: hasErrors,
            confirmButtonText: hasErrors ? 'ลองใหม่' : 'ตกลง',
            cancelButtonText: 'ปิด',
            confirmButtonColor: '#696CFF',
            width: 640,
          })
          if (hasErrors && isConfirmed) {
            await retryErrorQueue(userId)
            await this.handleSync()
          }
        }
      } finally {
        this.isSyncing = false
      }
    },
  }
}
</script>

<style scoped>
/* Add any custom styles here */
</style>
