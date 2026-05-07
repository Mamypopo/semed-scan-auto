import { prisma } from "../config/db.js";
import { Prisma } from "@prisma/client";

/**
 * สแกนจุดตรวจ (ใช้ CN.STATION_ID)
 * @param {Object} data - { cn, stationId, userId, cnGroupId? }
 * @returns {Promise<Object>} { success, message, patient, station, isNewScan, scanItem, registration, hasStationRemark?, stationRemark? }
 */
export const scanCheckpoint = async (data) => {
  const { cn, stationId, userId, cnGroupId, deleteRemark = false, scanType = "SCAN" } = data;
  const start = Date.now();

  try {
    // Parse CN และ Station ID จาก barcode (ถ้าส่งมาเป็น CN.STATION_ID)
    let finalCN = cn;
    let finalStationId = stationId;

    if (cn && cn.includes(".")) {
      // ถ้า barcode เป็น CN.STATION_ID
      const parts = cn.split(".");
      finalCN = parts[0];
      finalStationId = parseInt(parts[1]);
      if (isNaN(finalStationId)) {
        return {
          success: false,
          message: "รูปแบบบาร์โค้ดไม่ถูกต้อง: Station ID ต้องเป็นตัวเลข",
        };
      }
    } else if (!cn || !stationId) {
      return {
        success: false,
        message: "กรุณาระบุ CN และ Station ID",
      };
    } else {
      finalStationId = parseInt(stationId);
      if (isNaN(finalStationId)) {
        return {
          success: false,
          message: "Station ID ต้องเป็นตัวเลข",
        };
      }
    }

    // ดึงข้อมูลทั้งหมดที่จำเป็นในครั้งเดียว
    const [membership, station] = await Promise.all([
      prisma.cNGroupMembership.findFirst({
        where: {
          cn: finalCN,
          ...(cnGroupId ? { cnGroupId } : {}),
        },
        select: {
          id: true,
          patientId: true,
          cn: true,
          employeeCode: true,
          position: true,
          department: true,
          program: true,
          companyName: true,
          patient: {
            select: {
              id: true,
              hn: true,
              prefix: true,
              first_name: true,
              last_name: true,
              citizenId: true,
              passport_no: true,
            },
          },
          cnGroup: {
            select: {
              id: true,
              name: true,
            },
          },
          registrations: {
            where: {
              type: "CHECKUP",
              isCancelled: false,
            },
            orderBy: {
              registeredAt: "desc",
            },
            take: 1,
            select: {
              id: true,
              registeredAt: true,
              isCancelled: true,
            },
          },
          patientExaminationItems: {
            where: {
              status: 'ACTIVE',
            },
            include: {
              medicalItem: {
                select: {
                  id: true,
                  stationToMedicalItems: {
                    where: {
                      station: {
                        isActive: true,
                      },
                    },
                    include: {
                      station: {
                        select: {
                          id: true,
                          name: true,
                          isActive: true,
                          isSpecial: true,
                          specialType: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.station.findUnique({
        where: { id: finalStationId },
        select: {
          id: true,
          name: true,
          isActive: true,
          isSpecial: true,
          specialType: true,
        },
      }),
    ]);

    if (!membership) {
      return {
        success: false,
        message: `ไม่พบ CN: ${finalCN}${
          cnGroupId ? ` ใน CNGroup ที่เลือก` : ""
        }`,
      };
    }

    if (!station) {
      return {
        success: false,
        message: `ไม่พบจุดตรวจที่มี ID: ${finalStationId}`,
      };
    }

    if (!station.isActive) {
      return {
        success: false,
        message: `จุดตรวจ "${station.name}" ไม่ได้เปิดใช้งาน`,
      };
    }

    // ตรวจสอบว่ามี Registration หรือไม่
    const registration = membership.registrations[0];
    if (!registration) {
      return {
        success: false,
        message: `CN: ${finalCN} ยังไม่ได้ลงทะเบียน กรุณาลงทะเบียนก่อนเข้ารับการตรวจ`,
      };
    }

    // ตรวจสอบว่า Station อยู่ในรายการตรวจของ CNGroup หรือไม่
    const uniqueStationIds = [
      ...new Set(
        membership.patientExaminationItems
          .flatMap((item) => item.medicalItem.stationToMedicalItems)
          .filter((stm) => stm.station.isActive)
          .map((stm) => stm.station.id)
      ),
    ];

    const isStationAllowed = uniqueStationIds.includes(finalStationId);

    if (!isStationAllowed) {
      return {
        success: false,
        message: `จุดตรวจ "${station.name}" ไม่อยู่ในรายการตรวจของ CN: ${finalCN}`,
      };
    }

    // ดึงข้อมูล scan items + หมายเหตุจุดตรวจ (ถ้ามี) ในครั้งเดียว — ไม่เพิ่ม round-trip
    const [allPatientScans, existingScan, stationRemark] = await Promise.all([
      prisma.scanItem.findMany({
        where: {
          patientId: membership.patientId,
          stationId: finalStationId,
          registrationId: registration.id,
        },
        select: {
          id: true,
          scannedAt: true,
          isCancelled: true,
          cancelledAt: true,
          scannedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.scanItem.findFirst({
        where: {
          patientId: membership.patientId,
          stationId: finalStationId,
          registrationId: registration.id,
          isCancelled: false,
        },
        select: {
          id: true,
          scannedAt: true,
          scannedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.stationRemark.findUnique({
        where: {
          patientCNGroupId_stationId: {
            patientCNGroupId: membership.id,
            stationId: finalStationId,
          },
        },
        select: {
          id: true,
          remark: true,
          reason: { select: { id: true, title: true } },
        },
      }),
    ]);

    // ถ้ามีหมายเหตุจุดตรวจ และยังไม่ได้ยืนยัน → return ก่อนบันทึก scan
    if (!existingScan && stationRemark && !deleteRemark) {
      return {
        success: true,
        scanRecorded: false,
        hasStationRemark: true,
        stationRemark,
        patient: membership.patient,
        membership,
        station,
        registration,
      };
    }

    let scanItem,
      isNewScan = true,
      statusMessage = "",
      wasReinstated = false;

    if (existingScan) {
      scanItem = existingScan;
      isNewScan = false;
      const scannerName = existingScan.scannedByUser?.name || "ไม่ระบุ";
      statusMessage = `ผู้ป่วยได้รับการตรวจที่จุดตรวจนี้แล้ว เมื่อ ${new Date(
        existingScan.scannedAt
      ).toLocaleString("th-TH")} โดย ${scannerName}`;
    } else {
      const cancelledScan = allPatientScans
        .filter((scan) => scan.isCancelled)
        .sort((a, b) => new Date(b.cancelledAt) - new Date(a.cancelledAt))[0];

      scanItem = await prisma.scanItem.create({
        data: {
          patientId: membership.patientId,
          registrationId: registration.id,
          stationId: finalStationId,
          scannedBy: userId ? parseInt(userId) : null,
          isSpecialStation: station.isSpecial,
          specialType: station.specialType,
          scanType,
        },
        include: {
          scannedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
          patient: {
            select: {
              id: true,
              hn: true,
              first_name: true,
              last_name: true,
            },
          },
          station: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (cancelledScan) {
        wasReinstated = true;
        statusMessage = `บันทึกการสแกนใหม่หลังจากยกเลิก: ${
          membership.patient.prefix || ""
        } ${membership.patient.first_name} ${
          membership.patient.last_name
        } ที่จุดตรวจ ${station.name} เวลา ${new Date(
          scanItem.scannedAt
        ).toLocaleString("th-TH")}`;
      } else {
        statusMessage = `บันทึกการสแกนสำเร็จ: ${
          membership.patient.prefix || ""
        } ${membership.patient.first_name} ${
          membership.patient.last_name
        } ที่จุดตรวจ ${station.name} เวลา ${new Date(
          scanItem.scannedAt
        ).toLocaleString("th-TH")}`;
      }
    }

    // ลบหมายเหตุจุดตรวจถ้ายืนยัน
    if (deleteRemark && stationRemark) {
      await prisma.stationRemark.delete({ where: { id: stationRemark.id } });
    }

    return {
      scanItem,
      patient: membership.patient,
      membership,
      station,
      registration,
      isNewScan,
      wasReinstated,
      message: statusMessage,
      success: true,
      scanRecorded: true,
      hasStationRemark: !!stationRemark,
      stationRemark: stationRemark || null,
    };
  } catch (error) {
    console.error("Error in scanCheckpoint:", error);
    return {
      success: false,
      message: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง",
    };
  } finally {
    const end = Date.now();
    // console.log(`[scanCheckpoint service] ใช้เวลา: ${end - start} ms`)
  }
};

/**
 * ยกเลิกการสแกน
 * @param {string} scanItemId - ID ของ ScanItem
 * @param {number} userId - ID ของผู้ยกเลิก
 * @returns {Promise<Object>} { success, message }
 */
export const cancelScan = async (scanItemId, userId) => {
  try {
    const scanItem = await prisma.scanItem.findUnique({
      where: { id: scanItemId },
      include: {
        patient: {
          select: {
            id: true,
            hn: true,
            first_name: true,
            last_name: true,
          },
        },
        station: {
          select: {
            id: true,
            name: true,
          },
        },
        registration: {
          select: {
            id: true,
            patientCNGroup: {
              select: {
                id: true,
                cnGroupId: true,
              },
            },
          },
        },
      },
    });

    if (!scanItem) {
      return {
        success: false,
        message: "ไม่พบข้อมูลการสแกน",
      };
    }

    if (scanItem.isCancelled) {
      return {
        success: false,
        message: "การสแกนนี้ถูกยกเลิกไปแล้ว",
      };
    }

    await prisma.scanItem.update({
      where: { id: scanItemId },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledBy: userId ? parseInt(userId) : null,
      },
    });

    return {
      success: true,
      message: `ยกเลิกการสแกนสำเร็จ: ${scanItem.patient.first_name} ${scanItem.patient.last_name} ที่จุดตรวจ ${scanItem.station.name}`,
      scanItem,
    };
  } catch (error) {
    console.error("Error in cancelScan:", error);
    return {
      success: false,
      message: "เกิดข้อผิดพลาดในการยกเลิกการสแกน",
    };
  }
};

/**
 * ดึงสถิติการสแกนทั้งหมดสำหรับ CNGroup
 * @param {string} cnGroupId - CNGroup ID
 * @param {number} stationId - Station ID (optional)
 * @returns {Promise<object>} สถิติการสแกน
 */
export const getScanDashboard = async (
  cnGroupId,
  stationId = null,
  companies = [],
  createdByUserIds = []
) => {
  try {
    if (!cnGroupId) {
      throw new Error("CNGroup ID is required");
    }

    // ดึงข้อมูล CNGroup
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    // สร้าง company filter
    const companyFilter =
      Array.isArray(companies) && companies.length > 0
        ? { companyName: { in: companies } }
        : {};

    // สร้าง user filter (filter registrations by createdBy user)
    const userFilter =
      Array.isArray(createdByUserIds) && createdByUserIds.length > 0
        ? { createdBy: { in: createdByUserIds.map(Number) } }
        : {};

    // ดึงจำนวน Patient ทั้งหมดใน CNGroup ที่ลงทะเบียนแล้ว (filter by company)
    const totalPatients = await prisma.registration.count({
      where: {
        patientCNGroup: {
          cnGroupId: cnGroupId,
          ...companyFilter,
        },
        type: "CHECKUP",
        isCancelled: false,
      },
    });

    // สร้าง where condition สำหรับ scan items (filter by company)
    const scanWhere = {
      registration: {
        patientCNGroup: {
          cnGroupId: cnGroupId,
          ...companyFilter,
        },
        type: "CHECKUP",
        isCancelled: false,
      },
      isCancelled: false,
      ...(stationId ? { stationId: parseInt(stationId) } : {}),
    };

    // ดึงจำนวน Scan Items ที่สแกนแล้ว (ไม่ถูกยกเลิก)
    const scannedCount = await prisma.scanItem.count({
      where: scanWhere,
    });

    // ดึงจำนวน unique patients ที่สแกนแล้ว
    const scannedPatients = await prisma.scanItem.groupBy({
      by: ["patientId"],
      where: scanWhere,
    });

    const scanned = scannedPatients.length;
    const unscanned = totalPatients - scanned;

    // คำนวณเปอร์เซ็นต์
    const scanPercentage =
      totalPatients > 0 ? Math.round((scanned / totalPatients) * 100) : 0;

    // ดึง Medical Items ของ CNGroup
    const medicalItems = await prisma.medicalItem.findMany({
      where: {
        isActive: true,
        patientExaminationItems: {
          some: {
            patientCNGroup: {
              cnGroupId: cnGroupId,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    const medicalItemIds = medicalItems.map((item) => item.id);

    // ดึง Stations ที่เชื่อมกับ Medical Items ของ CNGroup
    const stationToMedicalItems = await prisma.stationToMedicalItem.findMany({
      where: {
        medicalItemId: { in: medicalItemIds },
      },
      select: {
        stationId: true,
      },
      distinct: ["stationId"],
    });

    const relevantStationIds = stationToMedicalItems.map(
      (item) => item.stationId
    );

    // ดึงข้อมูล Stations
    const stations = await prisma.station.findMany({
      where: {
        id: { in: relevantStationIds },
        isActive: true,
      },
      include: {
        stationToMedicalItems: {
          where: {
            medicalItemId: { in: medicalItemIds },
          },
          include: {
            medicalItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
    });

    // ดึงข้อมูล Memberships ทั้งหมดที่มี medical items ที่ตรงกับ station (เหมือนโปรเจคเก่า)
    // เพื่อคำนวณ totalRequired (ไม่ว่าจะลงทะเบียนหรือไม่)
    const allMemberships = await prisma.cNGroupMembership.findMany({
      where: {
        cnGroupId: cnGroupId,
        ...companyFilter,
        patient: {
          isActive: true,
        },
        patientExaminationItems: {
          some: {
            status: 'ACTIVE',
            medicalItemId: { in: medicalItemIds },
            type: 'CHECKUP',
          },
        },
      },
      include: {
        patientExaminationItems: {
          where: {
            status: 'ACTIVE',
            medicalItemId: { in: medicalItemIds },
            type: 'CHECKUP',
          },
          select: {
            medicalItemId: true,
          },
        },
        registrations: {
          where: {
            type: "CHECKUP",
            isCancelled: false,
          },
          select: {
            id: true,
            registeredAt: true,
          },
          take: 1,
        },
      },
    });

    // ดึงข้อมูล Registrations สำหรับคำนวณ registeredRequired (filter by company + user)
    const registrations = await prisma.registration.findMany({
      where: {
        patientCNGroup: {
          cnGroupId: cnGroupId,
          ...companyFilter,
        },
        type: "CHECKUP",
        isCancelled: false,
        ...userFilter,
      },
      include: {
        patientCNGroup: {
          include: {
            patientExaminationItems: {
              where: {
                status: 'ACTIVE',
                medicalItemId: { in: medicalItemIds },
                type: 'CHECKUP',
              },
              select: {
                medicalItemId: true,
              },
            },
          },
        },
      },
    });

    // สร้าง Map สำหรับเก็บ scan items ตาม station (filter by company + user)
    const scanItemsByStation = await prisma.scanItem.groupBy({
      by: ["stationId", "patientId"],
      where: {
        registration: {
          patientCNGroup: {
            cnGroupId: cnGroupId,
            ...companyFilter,
          },
          type: "CHECKUP",
          isCancelled: false,
          ...userFilter,
        },
        isCancelled: false,
        stationId: { in: relevantStationIds },
      },
    });

    // สร้าง Map สำหรับเก็บ station remarks (filter by company)
    const stationRemarks = await prisma.stationRemark.findMany({
      where: {
        patientCNGroup: {
          cnGroupId: cnGroupId,
          ...companyFilter,
        },
        stationId: { in: relevantStationIds },
      },
      select: {
        stationId: true,
        patientCNGroupId: true,
      },
    });

    // คำนวณสถิติแต่ละ Station
    const stationStats = stations.map((station) => {
      const stationMedicalItemIds = station.stationToMedicalItems.map(
        (item) => item.medicalItemId
      );

      // หา memberships ที่มี medical items ประเภท CHECKUP ที่ตรงกับ station นี้
      const membershipsAtStation = allMemberships.filter((membership) => {
        const patientMedicalItemIds = membership.patientExaminationItems.map(
          (item) => item.medicalItemId
        );
        return patientMedicalItemIds.some((id) =>
          stationMedicalItemIds.includes(id)
        );
      });

      // ถ้าไม่มีคน CHECKUP ที่ station นี้เลย → ไม่แสดง CHECKUP card
      if (membershipsAtStation.length === 0) return null;

      // หา registrations ที่มี medical items ที่ตรงกับ station นี้
      const relevantRegistrations = registrations.filter((reg) => {
        const patientMedicalItemIds =
          reg.patientCNGroup.patientExaminationItems.map(
            (item) => item.medicalItemId
          );
        return patientMedicalItemIds.some((id) =>
          stationMedicalItemIds.includes(id)
        );
      });

      // คำนวณ totalRequired และ registeredRequired (นับ unique patients)
      const totalRequired = membershipsAtStation.length;
      const registeredRequired = new Set(relevantRegistrations.map((r) => r.patientId)).size;
      const unregisteredRequired = Math.max(0, totalRequired - registeredRequired);

      // นับจำนวน scan ที่ station นี้ เฉพาะ CHECKUP patients เท่านั้น
      const checkupPatientIds = new Set(membershipsAtStation.map((m) => m.patientId));
      const scansAtStation = scanItemsByStation.filter(
        (scan) => scan.stationId === station.id && checkupPatientIds.has(scan.patientId)
      );
      const totalScans = scansAtStation.length;
      const uniqueScannedPatients = new Set(
        scansAtStation.map((scan) => scan.patientId)
      ).size;

      // นับจำนวน station remarks ที่ station นี้
      const checkupMembershipIds = new Set(membershipsAtStation.map((m) => m.id));
      const remarked = stationRemarks.filter(
        (remark) => remark.stationId === station.id && checkupMembershipIds.has(remark.patientCNGroupId)
      ).length;

      // คำนวณ missing (ขาดตรวจ)
      const missing = Math.max(
        0,
        registeredRequired - uniqueScannedPatients - remarked
      );

      // คำนวณ progress (รวม remarked)
      const progress =
        registeredRequired > 0
          ? Math.round(
              ((uniqueScannedPatients + remarked) / registeredRequired) * 100
            )
          : 0;

      return {
        id: station.id,
        name: station.name,
        priority: station.priority,
        examType: 'CHECKUP',
        totalScans,
        remarked,
        progress,
        missing,
        totalRequired,
        registeredRequired,
        unregisteredRequired,
      };
    }).filter(Boolean);

    // ดึง memberships ที่มี SPECIAL examination items
    const specialMemberships = await prisma.cNGroupMembership.findMany({
      where: {
        cnGroupId,
        ...companyFilter,
        patient: { isActive: true },
        patientExaminationItems: {
          some: { status: 'ACTIVE', medicalItemId: { in: medicalItemIds }, type: 'SPECIAL' }
        }
      },
      include: {
        patientExaminationItems: {
          where: { status: 'ACTIVE', medicalItemId: { in: medicalItemIds }, type: 'SPECIAL' },
          select: { medicalItemId: true }
        },
        registrations: {
          where: { type: 'CHECKUP', isCancelled: false },
          select: { id: true },
          take: 1
        }
      }
    });

    // Build specialByStation map: stationId → { membershipIds, patientIds, totalRequired, registeredRequired }
    const specialByStation = new Map();
    for (const station of stations) {
      const stationMedItemIds = station.stationToMedicalItems.map((s) => s.medicalItemId);
      const specialAtStation = specialMemberships.filter((m) =>
        m.patientExaminationItems.some((ei) => stationMedItemIds.includes(ei.medicalItemId))
      );
      if (specialAtStation.length === 0) continue;
      specialByStation.set(station.id, {
        membershipIds: new Set(specialAtStation.map((m) => m.id)),
        patientIds: new Set(specialAtStation.map((m) => m.patientId)),
        totalRequired: specialAtStation.length,
        registeredRequired: specialAtStation.filter((m) => m.registrations.length > 0).length
      });
    }

    // Append SPECIAL entries
    for (const [stationId, data] of specialByStation.entries()) {
      const baseStation = stations.find((s) => s.id === stationId);
      if (!baseStation) continue;
      const specialScans = scanItemsByStation.filter(
        (scan) => scan.stationId === stationId && data.patientIds.has(scan.patientId)
      );
      const uniqueScanned = new Set(specialScans.map((s) => s.patientId)).size;
      const specialRemarked = stationRemarks.filter(
        (r) => r.stationId === stationId && data.membershipIds.has(r.patientCNGroupId)
      ).length;
      const missing = Math.max(0, data.registeredRequired - uniqueScanned - specialRemarked);
      const progress = data.registeredRequired > 0
        ? Math.round(((uniqueScanned + specialRemarked) / data.registeredRequired) * 100)
        : 0;
      stationStats.push({
        id: stationId,
        name: baseStation.name,
        priority: baseStation.priority,
        examType: 'SPECIAL',
        totalScans: specialScans.length,
        remarked: specialRemarked,
        progress,
        missing,
        totalRequired: data.totalRequired,
        registeredRequired: data.registeredRequired,
        unregisteredRequired: data.totalRequired - data.registeredRequired
      });
    }

    // Sort: CHECKUP entries first (by priority), then SPECIAL entries last (by priority)
    stationStats.sort((a, b) => {
      if (a.examType !== b.examType) {
        return a.examType === 'SPECIAL' ? 1 : -1;
      }
      const pa = typeof a.priority === "number" ? a.priority : 9999;
      const pb = typeof b.priority === "number" ? b.priority : 9999;
      if (pa === 0 && pb !== 0) return 1;
      if (pb === 0 && pa !== 0) return -1;
      if (pa !== pb) return pa - pb;
      return a.id - b.id;
    });

    // ดึงข้อมูล Station (ถ้ามี stationId)
    let station = null;
    if (stationId) {
      station = await prisma.station.findUnique({
        where: { id: parseInt(stationId) },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });
    }

    return {
      cnGroup: {
        id: cnGroup.id,
        name: cnGroup.name,
        code: cnGroup.code,
      },
      station: station
        ? {
            id: station.id,
            name: station.name,
            isActive: station.isActive,
          }
        : null,
      summary: {
        totalPatients,
        scanned,
        unscanned: unscanned < 0 ? 0 : unscanned,
        scanPercentage,
        totalScans: scannedCount, // จำนวนครั้งที่สแกนทั้งหมด (อาจมีผู้ป่วยสแกนหลายครั้ง)
      },
      stationStats,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("❌ Get Scan Dashboard Service Error:", error);
    throw error;
  }
};

/**
 * ดึงสถิติสรุปสำหรับ Header Summary Bar
 * @param {string} cnGroupId - CNGroup ID
 * @param {Array<string>} companies - รายชื่อบริษัทที่เลือก (optional)
 * @returns {Promise<object>} สถิติสรุป
 */
export const getScanSummary = async (cnGroupId, companies = [], createdByUserIds = []) => {
  try {
    if (!cnGroupId) {
      throw new Error("CNGroup ID is required");
    }

    // ดึงข้อมูล CNGroup
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    // สร้าง company filter
    const companyFilter =
      Array.isArray(companies) && companies.length > 0
        ? { companyName: { in: companies } }
        : {};

    // สร้าง user filter (filter registrations by createdBy user)
    const userFilter =
      Array.isArray(createdByUserIds) && createdByUserIds.length > 0
        ? { createdBy: { in: createdByUserIds.map(Number) } }
        : {};

    // ดึงจำนวน Patient ทั้งหมดใน CNGroup (ไม่แยกสถานะการลงทะเบียน)
    const totalPatients = await prisma.cNGroupMembership.count({
      where: {
        cnGroupId: cnGroupId,
        patient: {
          isActive: true,
        },
        ...companyFilter,
      },
    });

    // ดึงจำนวน Patient ที่ลงทะเบียนแล้ว (filter by company)
    // ต้องดึง patientCNGroupId ที่ตรงกับ cnGroupId ก่อน (เพราะ groupBy ไม่รองรับ nested relation)
    const membershipWhere = {
      cnGroupId: cnGroupId,
      ...companyFilter,
    };

    const matchingMemberships = await prisma.cNGroupMembership.findMany({
      where: membershipWhere,
      select: {
        id: true,
      },
    });
    const matchingMembershipIds = matchingMemberships.map((m) => m.id);

    // ถ้าไม่มี membership ที่ตรงกับเงื่อนไข → ไม่มีคนลงทะเบียน
    if (matchingMembershipIds.length === 0) {
      return {
        cnGroup: {
          id: cnGroup.id,
          name: cnGroup.name,
          code: cnGroup.code,
        },
        summary: {
          totalPatients: 0,
          registered: 0,
          unregistered: 0,
          registrationPercentage: 0,
          totalScans: 0,
          specialCheckupCount: 0,
        },
        timestamp: new Date(),
      };
    }

    // ดึง registrations ที่ตรงกับ patientCNGroupId เหล่านี้ (filter by user ถ้ามี)
    const registeredPatients = await prisma.registration.groupBy({
      by: ["patientId"],
      where: {
        patientCNGroupId: { in: matchingMembershipIds },
        type: "CHECKUP",
        isCancelled: false,
        ...userFilter,
      },
    });

    const registered = registeredPatients.length;
    const unregistered = totalPatients - registered;

    // คำนวณเปอร์เซ็นต์
    const registrationPercentage =
      totalPatients > 0 ? Math.round((registered / totalPatients) * 100) : 0;

    // ดึงจำนวน Scan Items (filter by company + user)
    const scanItemsWhere = {
      registration: {
        patientCNGroup: {
          cnGroupId: cnGroupId,
          ...companyFilter,
        },
        type: "CHECKUP",
        isCancelled: false,
        ...userFilter,
      },
      isCancelled: false,
    };
    const totalScans = await prisma.scanItem.count({ where: scanItemsWhere });

    // นับจำนวน patients ที่มี special checkup (จาก PatientExaminationItem ที่ type: 'SPECIAL') - filter by company
    // ต้องดึง membershipIds ก่อน (เพราะ patientCNGroupId เป็น foreign key ไปที่ CNGroupMembership.id)
    const specialCheckupMembershipIds = await prisma.cNGroupMembership.findMany(
      {
        where: {
          cnGroupId: cnGroupId,
          ...companyFilter,
        },
        select: { id: true },
      }
    );
    const specialCheckupMembershipIdList = specialCheckupMembershipIds.map(
      (m) => m.id
    );

    let specialCheckupCount = 0;
    if (specialCheckupMembershipIdList.length > 0) {
      const specialCheckupPatients =
        await prisma.patientExaminationItem.groupBy({
          by: ["patientId"],
          where: {
            status: 'ACTIVE',
            patientCNGroupId: { in: specialCheckupMembershipIdList },
            type: "SPECIAL",
          },
        });
      specialCheckupCount = specialCheckupPatients.length;
    }

    return {
      cnGroup: {
        id: cnGroup.id,
        name: cnGroup.name,
        code: cnGroup.code,
      },
      summary: {
        totalPatients,
        registered,
        unregistered: unregistered < 0 ? 0 : unregistered,
        registrationPercentage,
        totalScans,
        specialCheckupCount,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("❌ Get Scan Summary Service Error:", error);
    throw error;
  }
};

/**
 * ดึงรายชื่อบริษัททั้งหมดใน CNGroup (สำหรับ Company Filter)
 * @param {string} cnGroupId - CNGroup ID
 * @returns {Promise<Array<string>>} รายชื่อบริษัท (unique, sorted)
 */
export const getCompaniesByCNGroup = async (cnGroupId) => {
  try {
    if (!cnGroupId) {
      throw new Error("CNGroup ID is required");
    }

    // ดึง unique company names จาก CNGroupMembership
    const memberships = await prisma.cNGroupMembership.findMany({
      where: {
        cnGroupId: cnGroupId,
        companyName: {
          not: null,
        },
      },
      select: {
        companyName: true,
      },
      distinct: ["companyName"],
    });

    // Extract และ sort company names
    const companies = memberships
      .map((m) => m.companyName)
      .filter((name) => name && name.trim() !== "")
      .sort();

    return companies;
  } catch (error) {
    console.error("❌ Get Companies By CNGroup Service Error:", error);
    throw error;
  }
};

/**
 * ดึงรายชื่อแผนกทั้งหมดใน CNGroup (สำหรับ Department Filter)
 * @param {string} cnGroupId - CNGroup ID
 * @param {Array<string>} companies - Array of company names to filter (optional)
 * @returns {Promise<Array<string>>} Array of department names
 */
export const getDepartmentsByCNGroup = async (cnGroupId, companies = []) => {
  try {
    if (!cnGroupId) {
      throw new Error("CNGroup ID is required");
    }

    // สร้าง company filter
    const companyFilter = (Array.isArray(companies) && companies.length > 0)
      ? { companyName: { in: companies } }
      : {};

    // ดึง unique department names จาก CNGroupMembership
    const memberships = await prisma.cNGroupMembership.findMany({
      where: {
        cnGroupId: cnGroupId,
        department: {
          not: null,
        },
        ...companyFilter,
      },
      select: {
        department: true,
      },
      distinct: ["department"],
    });

    // Extract และ sort department names
    const departments = memberships
      .map((m) => m.department)
      .filter((name) => name && name.trim() !== "")
      .sort();

    return departments;
  } catch (error) {
    console.error("❌ Get Departments By CNGroup Service Error:", error);
    throw error;
  }
};

/**
 * ดึงรายการสแกนล่าสุด
 * @param {object} filters - ตัวกรอง (cnGroupId, stationId, page, limit, search)
 * @returns {Promise<object>} รายการสแกนพร้อม pagination
 */
export const getScanList = async (filters = {}) => {
  try {
    const {
      cnGroupId,
      stationId,
      page = 1,
      limit = 20,
      search = "",
      dateFrom = null,
      dateTo = null,
      isCancelled = false,
    } = filters;

    const skip = (page - 1) * limit;
    const where = {
      isCancelled: isCancelled === true || isCancelled === "true",
      ...(cnGroupId
        ? {
            registration: {
              patientCNGroup: {
                cnGroupId: cnGroupId,
              },
              type: "CHECKUP",
              isCancelled: false,
            },
          }
        : {}),
      ...(stationId ? { stationId: parseInt(stationId) } : {}),
      ...(dateFrom || dateTo
        ? {
            scannedAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    // ถ้ามี search ให้ค้นหาตาม CN หรือชื่อผู้ป่วย
    if (search) {
      where.OR = [
        {
          registration: {
            patientCNGroup: {
              cn: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          patient: {
            OR: [
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
              { hn: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [scanItems, total] = await Promise.all([
      prisma.scanItem.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          patient: {
            select: {
              id: true,
              hn: true,
              prefix: true,
              first_name: true,
              last_name: true,
            },
          },
          station: {
            select: {
              id: true,
              name: true,
            },
          },
          registration: {
            select: {
              id: true,
              patientCNGroup: {
                select: {
                  id: true,
                  cn: true,
                },
              },
            },
          },
          scannedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
          cancelledByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          scannedAt: "desc",
        },
      }),
      prisma.scanItem.count({ where }),
    ]);

    return {
      data: scanItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("❌ Get Scan List Service Error:", error);
    throw error;
  }
};

/**
 * ดึงรายการสแกนตาม Membership ID
 * @param {string} membershipId - Membership ID (required)
 * @param {object} options - { page, limit, isCancelled }
 * @returns {Promise<object>} รายการสแกนพร้อม pagination
 */
export const getScanItemsByMembership = async (membershipId, options = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      isCancelled = undefined, // undefined = แสดงทั้งหมด, false = ไม่ยกเลิก, true = ยกเลิก
    } = options;

    if (!membershipId) {
      throw new Error("กรุณาระบุ membershipId");
    }

    const skip = (page - 1) * limit;
    const where = {
      // isCancelled: undefined = แสดงทั้งหมด, false = ไม่ยกเลิก, true = ยกเลิก
      ...(isCancelled !== undefined && isCancelled !== null
        ? { isCancelled: isCancelled === true || isCancelled === "true" }
        : {}),
      registration: {
        patientCNGroupId: membershipId,
        type: "CHECKUP",
        isCancelled: false,
      },
    };

    const [scanItems, total] = await Promise.all([
      prisma.scanItem.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          patient: {
            select: {
              id: true,
              hn: true,
              prefix: true,
              first_name: true,
              last_name: true,
            },
          },
          station: {
            select: {
              id: true,
              name: true,
            },
          },
          registration: {
            select: {
              id: true,
              patientCNGroup: {
                select: {
                  id: true,
                  cn: true,
                  cnGroup: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          scannedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
          cancelledByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          scannedAt: "desc",
        },
      }),
      prisma.scanItem.count({ where }),
    ]);

    return {
      data: scanItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("❌ Get Scan Items By Membership Service Error:", error);
    throw error;
  }
};

/**
 * ดึงรายชื่อ patients สำหรับ Scan Modal (รองรับ all, registered, unregistered, special_checkup)
 * @param {string} cnGroupId - CNGroup ID
 * @param {string} status - 'all', 'registered', 'unregistered', 'special_checkup'
 * @param {object} options - { search, page, limit, sortBy, sortOrder, remarkFilter, companies }
 * @returns {Promise<object>} รายการ patients พร้อม pagination
 */
export const getPatientsByScanStatus = async (
  cnGroupId,
  status,
  options = {}
) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      sortBy = "cn",
      sortOrder = "asc",
      remarkFilter = "all", // 'all', 'with_remark', 'without_remark'
      companies = [], // array of company names
      createdByUserIds = [], // array of user IDs who registered
    } = options;

    if (!cnGroupId) {
      throw new Error("CNGroup ID is required");
    }

    if (
      !["all", "registered", "unregistered", "special_checkup"].includes(status)
    ) {
      throw new Error(
        "Status must be 'all', 'registered', 'unregistered', or 'special_checkup'"
      );
    }

    // ดึง CNGroup info
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: { id: true, name: true, code: true },
    });

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    // สร้าง company filter
    const companyFilter =
      Array.isArray(companies) && companies.length > 0
        ? { companyName: { in: companies } }
        : {};

    // สร้าง user filter (filter registrations by createdBy user)
    const userFilter =
      Array.isArray(createdByUserIds) && createdByUserIds.length > 0
        ? { createdBy: { in: createdByUserIds.map(Number) } }
        : {};

    // สร้าง base membership where condition
    const baseMembershipWhere = {
      cnGroupId: cnGroupId,
      patient: {
        isActive: true,
      },
      ...companyFilter,
    };

    // ดึง patient IDs ที่ลงทะเบียนแล้ว (สำหรับ status filtering)
    const registeredPatientIds = await prisma.registration.findMany({
      where: {
        patientCNGroup: {
          cnGroupId: cnGroupId,
          ...companyFilter,
        },
        type: "CHECKUP",
        isCancelled: false,
        ...userFilter,
      },
      select: { patientId: true },
      distinct: ["patientId"],
    });
    const registeredIds = registeredPatientIds.map((r) => r.patientId);

    // ดึง patient IDs ที่มี special checkup (สำหรับ status filtering)
    let specialCheckupIds = [];
    if (status === "special_checkup") {
      const matchingMembershipIds = await prisma.cNGroupMembership.findMany({
        where: baseMembershipWhere,
        select: { id: true },
      });
      const membershipIds = matchingMembershipIds.map((m) => m.id);

      if (membershipIds.length > 0) {
        const specialPatients = await prisma.patientExaminationItem.groupBy({
          by: ["patientId"],
          where: {
            status: 'ACTIVE',
            patientCNGroupId: { in: membershipIds },
            type: "SPECIAL",
          },
        });
        specialCheckupIds = specialPatients.map((p) => p.patientId);
      }
    }

    // สร้าง membership where condition ตาม status
    const membershipWhere = { ...baseMembershipWhere };

    if (status === "registered") {
      if (registeredIds.length > 0) {
        membershipWhere.patientId = { in: registeredIds };
      } else {
        // ไม่มีคนลงทะเบียน → return empty
        return {
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            limit: limit,
          },
        };
      }
    } else if (status === "unregistered") {
      if (registeredIds.length > 0) {
        membershipWhere.patientId = { notIn: registeredIds };
      }
    } else if (status === "special_checkup") {
      if (specialCheckupIds.length > 0) {
        membershipWhere.patientId = { in: specialCheckupIds };
      } else {
        // ไม่มีคน special checkup → return empty
        return {
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            limit: limit,
          },
        };
      }
    }
    // status === 'all' → ไม่ filter patientId

    // Filter by remark
    if (remarkFilter === "with_remark") {
      if (!membershipWhere.AND) {
        membershipWhere.AND = [];
      }
      membershipWhere.AND.push(
        { remark: { not: null } },
        { remark: { not: "" } }
      );
    } else if (remarkFilter === "without_remark") {
      membershipWhere.OR = [{ remark: null }, { remark: "" }];
    }

    // Search condition
    if (search) {
      const searchConditions = [
        { cn: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
        {
          patient: {
            OR: [
              { hn: { contains: search, mode: "insensitive" } },
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
              { citizenId: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];

      if (membershipWhere.OR) {
        // ถ้ามี remarkFilter = 'without_remark' แล้ว ให้รวม search conditions
        membershipWhere.AND = [
          { OR: membershipWhere.OR },
          { OR: searchConditions },
        ];
        delete membershipWhere.OR;
      } else {
        membershipWhere.OR = searchConditions;
      }
    }

    // OrderBy - แปลง sortBy สำหรับ fields ที่ต้อง sort ผ่าน relation
    let membershipOrderBy;
    const useRawQueryForRegisteredAt = sortBy === "registeredAt";
    
    if (sortBy === "name") {
      // Sort by patient name (first_name, last_name)
      membershipOrderBy = {
        patient: {
          first_name: sortOrder,
        },
      };
    } else if (useRawQueryForRegisteredAt) {
      // Sort by registration date - ใช้ raw SQL query เพื่อประสิทธิภาพที่ดีที่สุด
      // จะ query โดยตรงใน database แทนการดึงข้อมูลทั้งหมดมา sort
      membershipOrderBy = null; // จะใช้ raw query แทน
    } else if (["employeeCode", "position", "department", "companyName", "cn"].includes(sortBy)) {
      // Sort by field ใน CNGroupMembership โดยตรง
      membershipOrderBy = { [sortBy]: sortOrder };
    } else {
      // Default: sort by cn
      membershipOrderBy = { cn: sortOrder };
    }

    // Query จาก CNGroupMembership พร้อม include ข้อมูลที่จำเป็น
    let totalCount, memberships;
    
    if (useRawQueryForRegisteredAt) {
      // BEST PRACTICE: ใช้ raw SQL query เพื่อ sort by registeredAt โดยตรงใน database
      // ประสิทธิภาพดีกว่าการดึงข้อมูลทั้งหมดมา sort ใน application layer
      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      // Build WHERE clause จาก membershipWhere
      if (membershipWhere.cnGroupId) {
        whereConditions.push(`m."cnGroupId" = $${paramIndex++}`);
        queryParams.push(membershipWhere.cnGroupId);
      }
      
      if (membershipWhere.patient?.isActive !== undefined) {
        whereConditions.push(`p."isActive" = $${paramIndex++}`);
        queryParams.push(membershipWhere.patient.isActive);
      }
      
      if (membershipWhere.companyName?.in) {
        whereConditions.push(`m."companyName" = ANY($${paramIndex++}::text[])`);
        queryParams.push(membershipWhere.companyName.in);
      }
      
      if (membershipWhere.patientId?.in) {
        whereConditions.push(`m."patientId" = ANY($${paramIndex++}::int[])`);
        queryParams.push(membershipWhere.patientId.in);
      }
      
      if (membershipWhere.patientId?.notIn) {
        whereConditions.push(`m."patientId" != ALL($${paramIndex++}::int[])`);
        queryParams.push(membershipWhere.patientId.notIn);
      }
      
      // Handle AND conditions
      if (membershipWhere.AND) {
        membershipWhere.AND.forEach((condition) => {
          if (condition.remark?.not !== undefined) {
            if (condition.remark.not === null) {
              whereConditions.push(`m."remark" IS NOT NULL`);
            } else if (condition.remark.not === "") {
              whereConditions.push(`m."remark" != $${paramIndex++}`);
              queryParams.push("");
            }
          }
        });
      }
      
      // Handle OR conditions (remark filter)
      if (membershipWhere.OR) {
        const orConditions = [];
        membershipWhere.OR.forEach((condition) => {
          if (condition.remark === null || condition.remark === "") {
            orConditions.push(`(m."remark" IS NULL OR m."remark" = '')`);
          }
        });
        if (orConditions.length > 0) {
          whereConditions.push(`(${orConditions.join(" OR ")})`);
        }
      }
      
      // Handle search conditions
      if (membershipWhere.OR && Array.isArray(membershipWhere.OR)) {
        const searchOrConditions = [];
        membershipWhere.OR.forEach((condition) => {
          if (condition.cn?.contains) {
            searchOrConditions.push(`m."cn" ILIKE $${paramIndex++}`);
            queryParams.push(`%${condition.cn.contains}%`);
          }
          if (condition.employeeCode?.contains) {
            searchOrConditions.push(`m."employeeCode" ILIKE $${paramIndex++}`);
            queryParams.push(`%${condition.employeeCode.contains}%`);
          }
          if (condition.patient?.OR) {
            condition.patient.OR.forEach((patientCondition) => {
              if (patientCondition.hn?.contains) {
                searchOrConditions.push(`p."hn" ILIKE $${paramIndex++}`);
                queryParams.push(`%${patientCondition.hn.contains}%`);
              }
              if (patientCondition.first_name?.contains) {
                searchOrConditions.push(`p."first_name" ILIKE $${paramIndex++}`);
                queryParams.push(`%${patientCondition.first_name.contains}%`);
              }
              if (patientCondition.last_name?.contains) {
                searchOrConditions.push(`p."last_name" ILIKE $${paramIndex++}`);
                queryParams.push(`%${patientCondition.last_name.contains}%`);
              }
              if (patientCondition.citizenId?.contains) {
                searchOrConditions.push(`p."citizenId" ILIKE $${paramIndex++}`);
                queryParams.push(`%${patientCondition.citizenId.contains}%`);
              }
            });
          }
        });
        if (searchOrConditions.length > 0) {
          whereConditions.push(`(${searchOrConditions.join(" OR ")})`);
        }
      }

      // Build WHERE clause string with parameterized query (ป้องกัน SQL injection)
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(" AND ")}` 
        : "";

      // Raw SQL query with LEFT JOIN LATERAL for latest registration
      // BEST PRACTICE: ใช้ parameterized query เพื่อป้องกัน SQL injection
      const orderDirection = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
      const nullsPosition = sortOrder.toUpperCase() === "DESC" ? "NULLS LAST" : "NULLS FIRST";
      
      const sqlQuery = `
        SELECT 
          m.id,
          m."patientId",
          m."cnGroupId",
          m.cn,
          m."employeeCode",
          m.position,
          m.department,
          m."companyName",
          m.program,
          m.note,
          m.remark,
          m."createdAt",
          m."updatedAt",
          p.id as "patient_id",
          p.hn,
          p.prefix,
          p."first_name",
          p."last_name",
          p."citizenId",
          p."birth_date",
          p.gender,
          p."phone_1",
          p.email,
          p."isActive",
          r."patientId" as "reg_patientId",
          r."registeredAt" as "reg_registeredAt",
          r."createdAt" as "reg_createdAt"
        FROM "CNGroupMembership" m
        INNER JOIN "Patient" p ON m."patientId" = p.id
        LEFT JOIN LATERAL (
          SELECT "patientId", "registeredAt", "createdAt"
          FROM "Registration"
          WHERE "patientCNGroupId" = m.id
            AND type = 'CHECKUP'
            AND "isCancelled" = false
          ORDER BY "createdAt" DESC
          LIMIT 1
        ) r ON true
        ${whereClause}
        ORDER BY COALESCE(r."registeredAt", r."createdAt") ${orderDirection} ${nullsPosition}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;

      // Add limit and offset to params
      queryParams.push(limit, (page - 1) * limit);

      // Execute parameterized raw query (ปลอดภัยจาก SQL injection)
      const rawResults = await prisma.$queryRawUnsafe(sqlQuery, ...queryParams);

      // Get total count
      totalCount = await prisma.cNGroupMembership.count({
        where: membershipWhere,
      });

      // Transform raw results to Prisma format
      memberships = rawResults.map((row) => ({
        id: row.id,
        patientId: row.patientId,
        cnGroupId: row.cnGroupId,
        cn: row.cn,
        employeeCode: row.employeeCode,
        position: row.position,
        department: row.department,
        companyName: row.companyName,
        program: row.program,
        note: row.note,
        remark: row.remark,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        patient: {
          id: row.patient_id,
          hn: row.hn,
          prefix: row.prefix,
          first_name: row.first_name,
          last_name: row.last_name,
          citizenId: row.citizenId,
          birth_date: row.birth_date,
          gender: row.gender,
          phone_1: row.phone_1,
          email: row.email,
          isActive: row.isActive,
        },
        registrations: row.reg_patientId
          ? [
              {
                patientId: row.reg_patientId,
                registeredAt: row.reg_registeredAt,
                createdAt: row.reg_createdAt,
              },
            ]
          : [],
      }));
    } else {
      // ใช้ Prisma findMany สำหรับ sort fields อื่นๆ (เร็วกว่า raw query)
      [totalCount, memberships] = await Promise.all([
        prisma.cNGroupMembership.count({
          where: membershipWhere,
        }),
        prisma.cNGroupMembership.findMany({
          where: membershipWhere,
          orderBy: membershipOrderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            patient: {
              select: {
                id: true,
                hn: true,
                prefix: true,
                first_name: true,
                last_name: true,
                citizenId: true,
                birth_date: true,
                gender: true,
                phone_1: true,
                email: true,
                isActive: true,
              },
            },
            // Include registration (ล่าสุด) เพื่อลด query
            registrations: {
              where: {
                type: "CHECKUP",
                isCancelled: false,
              },
              select: {
                patientId: true,
                registeredAt: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        }),
      ]);
    }

    // Group registrations by patientId (จาก included data)
    const registrationsByPatientId = new Map();
    memberships.forEach((membership) => {
      if (membership.registrations && membership.registrations.length > 0) {
        const reg = membership.registrations[0];
        if (!registrationsByPatientId.has(reg.patientId)) {
          registrationsByPatientId.set(reg.patientId, reg);
        }
      }
    });

    // ดึง special checkup items และราคาสำหรับแต่ละ membership (optimize: รวม queries)
    const membershipIds = memberships.map((m) => m.id);
    const specialCheckupItems =
      membershipIds.length > 0
        ? await prisma.patientExaminationItem.findMany({
            where: {
              status: 'ACTIVE',
              patientCNGroupId: { in: membershipIds },
              type: "SPECIAL",
            },
            select: {
              patientCNGroupId: true,
              price: true,
              discount: true,
              quantity: true,
              createdAt: true,
              parentPackageId: true,
              patientPackageSelection: {
                select: { id: true, snapshotPrice: true }
              },
            },
          })
        : [];

    // คำนวณราคารวม special checkup สำหรับแต่ละ membership (ใช้ Map)
    // แพคเกจ → ใช้ snapshotPrice (นับครั้งเดียวต่อ patientPackageSelection)
    // item เดี่ยว → price × quantity - discount
    const specialCheckupPriceByMembership = new Map();
    const countedPackageSelections = new Set();
    const specialCheckupsByMembership = new Map();
    specialCheckupItems.forEach((item) => {
      const currentPrice = specialCheckupPriceByMembership.get(item.patientCNGroupId) || 0;
      let itemContribution = 0;
      if (item.parentPackageId && item.patientPackageSelection) {
        // item อยู่ในแพคเกจ → นับ snapshotPrice ครั้งเดียวต่อ patientPackageSelection
        const selId = item.patientPackageSelection.id;
        if (!countedPackageSelections.has(selId)) {
          countedPackageSelections.add(selId);
          itemContribution = Number(item.patientPackageSelection.snapshotPrice) || 0;
        }
      } else if (!item.parentPackageId) {
        // item เดี่ยว
        itemContribution = (Number(item.price) || 0) * (Number(item.quantity) || 1) - (Number(item.discount) || 0);
      }
      specialCheckupPriceByMembership.set(
        item.patientCNGroupId,
        currentPrice + itemContribution
      );
      
      // เก็บ specialCheckups array สำหรับแต่ละ membership
      if (!specialCheckupsByMembership.has(item.patientCNGroupId)) {
        specialCheckupsByMembership.set(item.patientCNGroupId, []);
      }
      specialCheckupsByMembership.get(item.patientCNGroupId).push({
        createdAt: item.createdAt,
      });
    });

    // Format response
    const formattedPatients = memberships.map((membership) => {
      const patient = membership.patient;
      const registration = registrationsByPatientId.get(patient.id) || null;
      const specialCheckupPrice =
        specialCheckupPriceByMembership.get(membership.id) || 0;

      const specialCheckups = specialCheckupsByMembership.get(membership.id) || [];

      return {
        id: patient.id,
        hn: patient.hn,
        prefix: patient.prefix,
        first_name: patient.first_name,
        last_name: patient.last_name,
        citizenId: patient.citizenId,
        birth_date: patient.birth_date,
        gender: patient.gender,
        phone_1: patient.phone_1,
        email: patient.email,
        membershipId: membership.id,
        cn: membership.cn,
        employeeCode: membership.employeeCode,
        position: membership.position,
        department: membership.department,
        companyName: membership.companyName,
        program: membership.program,
        note: membership.note,
        remark: membership.remark,
        registeredAt: registration?.registeredAt || null,
        registrationCreatedAt: registration?.createdAt || null,
        isRegistered: !!registration,
        specialCheckupPrice: specialCheckupPrice,
        specialCheckups: specialCheckups,
      };
    });

    return {
      success: true,
      data: formattedPatients,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        limit: limit,
      },
    };
  } catch (error) {
    console.error("❌ Get Patients By Scan Status Service Error:", error);
    throw error;
  }
};

/**
 * ดึงรายชื่อ patients ตาม Station (สำหรับ Station Modal)
 * @param {string} cnGroupId - CNGroup ID
 * @param {number} stationId - Station ID
 * @param {object} options - { search, page, limit, sortBy, sortOrder, scanStatus, registrationStatus, stationRemarkFilter, companies }
 * @returns {Promise<object>} รายการ patients พร้อม pagination
 */
/**
 * ดึงสถิติการยิงตัวอย่างของ user วันนี้ แยกตาม station
 * @param {string} userId - ID ของ user
 * @param {string} cnGroupId - ID ของ CNGroup
 * @returns {Promise<Array>} รายการสถิติแยกตาม station [{ stationId, stationName, count }]
 */
export const getUserScanSummaryToday = async (userId, cnGroupId) => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  try {
    const [logs, allStations] = await Promise.all([
      prisma.scanItemLog.findMany({
        where: {
          userId: parseInt(userId),
          action: 'SCAN',
          createdAt: {
            gte: startOfDay
          },
          scanItem: {
            isCancelled: false,
            registration: {
              patientCNGroup: {
                cnGroupId: cnGroupId
              },
              type: 'CHECKUP',
              isCancelled: false
            }
          }
        },
        select: {
          scanItem: {
            select: {
              stationId: true
            }
          }
        }
      }),
      prisma.station.findMany({
        select: { id: true, name: true },
        where: { isActive: true }
      })
    ])

    if (logs.length === 0) {
      return []
    }

    const stationMap = new Map(allStations.map(s => [s.id, s.name]))

    // Group by stationId
    const stationCounts = new Map()
    logs.forEach(log => {
      const stationId = log.scanItem?.stationId
      if (stationId) {
        const current = stationCounts.get(stationId) || 0
        stationCounts.set(stationId, current + 1)
      }
    })

    return Array.from(stationCounts.entries()).map(([stationId, count]) => ({
      stationId,
      stationName: stationMap.get(stationId) || '-',
      count
    }))
  } catch (error) {
    console.error('Error in getUserScanSummaryToday:', error)
    return []
  }
}

export const getPatientsByStation = async (cnGroupId, stationId, options = {}) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      sortBy = "cn",
      sortOrder = "asc",
      scanStatus = "all", // 'all', 'scanned', 'missing' (ตรวจแล้ว, ขาดตรวจ)
      registrationStatus = "all", // 'all', 'registered', 'unregistered'
      stationRemarkFilter = "all", // 'all', 'with_remark', 'without_remark'
      companies = [], // array of company names
      createdByUserIds = [], // array of user IDs who registered
      examType = null, // 'CHECKUP', 'SPECIAL', or null = ไม่กรอง
    } = options;

    if (!cnGroupId) {
      throw new Error("CNGroup ID is required");
    }

    if (!stationId) {
      throw new Error("Station ID is required");
    }

    // Validate scanStatus
    if (!["all", "scanned", "missing"].includes(scanStatus)) {
      throw new Error("scanStatus must be 'all', 'scanned', or 'missing'");
    }

    // Validate registrationStatus
    if (!["all", "registered", "unregistered"].includes(registrationStatus)) {
      throw new Error("registrationStatus must be 'all', 'registered', or 'unregistered'");
    }

    // Validate stationRemarkFilter
    if (!["all", "with_remark", "without_remark"].includes(stationRemarkFilter)) {
      throw new Error("stationRemarkFilter must be 'all', 'with_remark', or 'without_remark'");
    }

    // Validate CNGroup และ Station (ใช้ select เฉพาะ id เพื่อ performance)
    const [cnGroup, station] = await Promise.all([
      prisma.cNGroup.findUnique({
        where: { id: cnGroupId },
        select: { id: true },
      }),
      prisma.station.findUnique({
        where: { id: parseInt(stationId) },
        select: { id: true },
      }),
    ]);

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    if (!station) {
      throw new Error(`ไม่พบ Station รหัส ${stationId}`);
    }

    // สร้าง company filter
    const companyFilter =
      Array.isArray(companies) && companies.length > 0
        ? { companyName: { in: companies } }
        : {};

    // สร้าง user filter (filter registrations by createdBy user)
    const userFilter =
      Array.isArray(createdByUserIds) && createdByUserIds.length > 0
        ? { createdBy: { in: createdByUserIds.map(Number) } }
        : {};

    // ดึง Medical Items ที่เชื่อมกับ Station นี้
    const stationToMedicalItems = await prisma.stationToMedicalItem.findMany({
      where: {
        stationId: parseInt(stationId),
      },
      select: {
        medicalItemId: true,
      },
    });

    const medicalItemIds = stationToMedicalItems.map((item) => item.medicalItemId);

    if (medicalItemIds.length === 0) {
      return {
        success: true,
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          limit: limit,
        },
      };
    }

    // สร้าง base membership where condition (เหมือนโปรเจคเก่า: filter employees ที่มี checkups ที่ตรงกับ station)
    // Filter เฉพาะ patients ที่มี medical items ที่เชื่อมกับ station นี้
    const baseMembershipWhere = {
      cnGroupId: cnGroupId,
      patient: {
        isActive: true,
      },
      ...companyFilter,
      patientExaminationItems: {
        some: {
          status: 'ACTIVE',
          medicalItemId: { in: medicalItemIds },
          ...(examType ? { type: examType } : {}),
        },
      },
    };

    // ดึงข้อมูลทั้งหมดพร้อมกันเพื่อเพิ่มประสิทธิภาพ (ใช้ groupBy/distinct แทน findMany)
    const [
      scannedPatientGroupBy,
      registeredPatientIds,
      relevantMembershipIds,
    ] = await Promise.all([
      // ดึง patient IDs ที่สแกนแล้วที่ station นี้ (ใช้ groupBy เพื่อ performance)
      prisma.scanItem.groupBy({
        by: ["patientId"],
        where: {
          stationId: parseInt(stationId),
          isCancelled: false,
          registration: {
            patientCNGroup: {
              cnGroupId: cnGroupId,
              ...companyFilter,
            },
            type: "CHECKUP",
            isCancelled: false,
            ...userFilter,
          },
        },
      }),
      // ดึง patient IDs ที่ลงทะเบียนแล้วและมี medical items ที่ตรงกับ station นี้
      prisma.registration.findMany({
        where: {
          patientCNGroup: baseMembershipWhere,
          type: "CHECKUP",
          isCancelled: false,
          ...userFilter,
        },
        select: { patientId: true },
        distinct: ["patientId"],
      }),
      // ดึง membership IDs ที่มี medical items ที่ตรงกับ station นี้
      prisma.cNGroupMembership.findMany({
        where: baseMembershipWhere,
        select: { id: true },
      }),
    ]);

    // แปลงผลลัพธ์
    const scannedIds = scannedPatientGroupBy.map((item) => item.patientId);
    const registeredIds = registeredPatientIds.map((r) => r.patientId);
    const relevantMembershipIdList = relevantMembershipIds.map((m) => m.id);

    // ดึง patient IDs ที่มี StationRemark ที่ station นี้ (หลังจากได้ relevantMembershipIds)
    const remarkedMembershipIdList =
      relevantMembershipIdList.length > 0
        ? (
            await prisma.stationRemark.findMany({
              where: {
                stationId: parseInt(stationId),
                patientCNGroupId: { in: relevantMembershipIdList },
              },
              select: { patientCNGroupId: true },
            })
          ).map((r) => r.patientCNGroupId)
        : [];

    // สร้าง membership where condition ตาม filters
    const membershipWhere = { ...baseMembershipWhere };

    // Filter by registrationStatus
    if (registrationStatus === "registered") {
      if (registeredIds.length > 0) {
        membershipWhere.patientId = { in: registeredIds };
      } else {
        return {
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            limit: limit,
          },
        };
      }
    } else if (registrationStatus === "unregistered") {
      if (registeredIds.length > 0) {
        membershipWhere.patientId = { notIn: registeredIds };
      }
    }

    // Filter by scanStatus (ต้องทำหลังจาก filter registrationStatus)
    if (scanStatus === "scanned") {
      if (scannedIds.length > 0) {
        if (membershipWhere.patientId) {
          // ถ้ามี registrationStatus filter แล้ว ให้ intersect
          const filteredIds = registeredIds.filter((id) => scannedIds.includes(id));
          if (filteredIds.length > 0) {
            membershipWhere.patientId = { in: filteredIds };
          } else {
            return {
              success: true,
              data: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalItems: 0,
                limit: limit,
              },
            };
          }
        } else {
          membershipWhere.patientId = { in: scannedIds };
        }
      } else {
        return {
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            limit: limit,
          },
        };
      }
    } else if (scanStatus === "missing") {
      // ขาดตรวจ = ลงทะเบียนแล้ว แต่ยังไม่สแกน (รวมคนที่มี remark ด้วย)
      // ต้องดึง membershipIds ที่ตรงกับเงื่อนไข
      const registeredMemberships = await prisma.cNGroupMembership.findMany({
        where: {
          cnGroupId: cnGroupId,
          patientId: { in: registeredIds },
          ...companyFilter,
          patientExaminationItems: {
            some: {
              status: 'ACTIVE',
              medicalItemId: { in: medicalItemIds },
              ...(examType ? { type: examType } : {}),
            },
          },
        },
        select: { id: true, patientId: true },
      });

      // Filter membershipIds ที่ยังไม่สแกน (ไม่ต้อง filter remark ออก)
      const missingMembershipIds = registeredMemberships
        .filter(
          (m) =>
            !scannedIds.includes(m.patientId)
        )
        .map((m) => m.id);

      if (missingMembershipIds.length > 0) {
        if (!membershipWhere.AND) {
          membershipWhere.AND = [];
        }
        membershipWhere.AND.push({
          id: { in: missingMembershipIds },
        });
      } else {
        return {
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            limit: limit,
          },
        };
      }
    }

    // Filter by stationRemarkFilter
    if (stationRemarkFilter === "with_remark") {
      if (remarkedMembershipIdList.length > 0) {
        if (!membershipWhere.AND) {
          membershipWhere.AND = [];
        }
        membershipWhere.AND.push({
          id: { in: remarkedMembershipIdList },
        });
      } else {
        return {
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            limit: limit,
          },
        };
      }
    } else if (stationRemarkFilter === "without_remark") {
      if (remarkedMembershipIdList.length > 0) {
        if (!membershipWhere.AND) {
          membershipWhere.AND = [];
        }
        membershipWhere.AND.push({
          id: { notIn: remarkedMembershipIdList },
        });
      }
    }

    // Search condition
    if (search) {
      const searchConditions = [
        { cn: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
        {
          patient: {
            OR: [
              { hn: { contains: search, mode: "insensitive" } },
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
              { citizenId: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];

      // ต้อง wrap baseMembershipWhere conditions ไว้ใน AND เพื่อไม่ให้ OR override filter เดิม
      if (membershipWhere.AND) {
        membershipWhere.AND.push({ OR: searchConditions });
      } else {
        // สร้าง AND condition ที่รวม baseMembershipWhere conditions กับ search conditions
        // เก็บ patientExaminationItems filter ไว้ใน AND
        const baseConditions = [];
        if (membershipWhere.patientExaminationItems) {
          baseConditions.push({
            patientExaminationItems: membershipWhere.patientExaminationItems,
          });
        }
        if (membershipWhere.cnGroupId) {
          baseConditions.push({ cnGroupId: membershipWhere.cnGroupId });
        }
        if (membershipWhere.patient) {
          baseConditions.push({ patient: membershipWhere.patient });
        }
        if (Object.keys(companyFilter).length > 0) {
          baseConditions.push(companyFilter);
        }
        
        membershipWhere.AND = [
          ...baseConditions,
          { OR: searchConditions },
        ];
        // ลบ properties ที่ย้ายไปอยู่ใน AND แล้ว
        delete membershipWhere.patientExaminationItems;
        delete membershipWhere.cnGroupId;
        delete membershipWhere.patient;
        Object.keys(companyFilter).forEach((key) => {
          delete membershipWhere[key];
        });
      }
    }

    // OrderBy - แปลง sortBy สำหรับ fields ที่ต้อง sort ผ่าน relation
    let membershipOrderBy;
    const useRawQueryForRegisteredAt = sortBy === "registeredAt";
    
    if (sortBy === "name") {
      // Sort by patient name (first_name, last_name)
      membershipOrderBy = {
        patient: {
          first_name: sortOrder,
        },
      };
    } else if (useRawQueryForRegisteredAt) {
      // Sort by registration date - ใช้ raw SQL query เพื่อประสิทธิภาพที่ดีที่สุด
      membershipOrderBy = null; // จะใช้ raw query แทน
    } else if (["employeeCode", "position", "department", "companyName", "cn"].includes(sortBy)) {
      // Sort by field ใน CNGroupMembership โดยตรง
      membershipOrderBy = { [sortBy]: sortOrder };
    } else {
      // Default: sort by cn
      membershipOrderBy = { cn: sortOrder };
    }

    // Query จาก CNGroupMembership พร้อม include ข้อมูลที่จำเป็น
    let totalCount, memberships;
    
    if (useRawQueryForRegisteredAt) {
      // Step 1: ดึง membership IDs ที่ตรงกับเงื่อนไขทั้งหมด (ใช้ Prisma)
      const matchingMemberships = await prisma.cNGroupMembership.findMany({
        where: membershipWhere,
        select: { id: true },
      });
      const membershipIds = matchingMemberships.map((m) => m.id);
      
      if (membershipIds.length === 0) {
        totalCount = 0;
        memberships = [];
      } else {
        // Step 2: ใช้ raw SQL query เพื่อ sort by registeredAt และ paginate
        const orderDirection = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
        const nullsPosition = sortOrder.toUpperCase() === "DESC" ? "NULLS LAST" : "NULLS FIRST";
        
        const sqlQuery = `
          SELECT 
            m.id,
            m."patientId",
            m."cnGroupId",
            m.cn,
            m."employeeCode",
            m.position,
            m.department,
            m."companyName",
            m.program,
            m.note,
            m.remark,
            m."createdAt",
            m."updatedAt",
            p.id as "patient_id",
            p.prefix,
            p."first_name",
            p."last_name",
            p."citizenId",
            p."birth_date",
            p.gender,
            p."phone_1",
            p.email,
            p."isActive",
            r."patientId" as "reg_patientId",
            r."registeredAt" as "reg_registeredAt",
            r."createdAt" as "reg_createdAt"
          FROM "CNGroupMembership" m
          INNER JOIN "Patient" p ON m."patientId" = p.id
          LEFT JOIN LATERAL (
            SELECT "patientId", "registeredAt", "createdAt"
            FROM "Registration"
            WHERE "patientCNGroupId" = m.id
              AND type = 'CHECKUP'
              AND "isCancelled" = false
            ORDER BY "createdAt" DESC
            LIMIT 1
          ) r ON true
          WHERE m.id = ANY($1::text[])
          ORDER BY COALESCE(r."registeredAt", r."createdAt") ${orderDirection} ${nullsPosition}
          LIMIT $2 OFFSET $3
        `;

        const rawResults = await prisma.$queryRawUnsafe(
          sqlQuery,
          membershipIds,
          limit,
          (page - 1) * limit
        );

        // Get total count
        totalCount = membershipIds.length;

        // Transform raw results to Prisma format
        memberships = rawResults.map((row) => ({
          id: row.id,
          patientId: row.patientId,
          cnGroupId: row.cnGroupId,
          cn: row.cn,
          employeeCode: row.employeeCode,
          position: row.position,
          department: row.department,
          companyName: row.companyName,
          program: row.program,
          note: row.note,
          remark: row.remark,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          patient: {
            id: row.patient_id,
            prefix: row.prefix,
            first_name: row.first_name,
            last_name: row.last_name,
            citizenId: row.citizenId,
            birth_date: row.birth_date,
            gender: row.gender,
            phone_1: row.phone_1,
            email: row.email,
            isActive: row.isActive,
          },
          registrations: row.reg_patientId
            ? [
                {
                  patientId: row.reg_patientId,
                  registeredAt: row.reg_registeredAt,
                  createdAt: row.reg_createdAt,
                },
              ]
            : [],
        }));
      }
    } else {
      // ใช้ Prisma findMany สำหรับ sort fields อื่นๆ 
      [totalCount, memberships] = await Promise.all([
        prisma.cNGroupMembership.count({
          where: membershipWhere,
        }),
        prisma.cNGroupMembership.findMany({
          where: membershipWhere,
          orderBy: membershipOrderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            patient: {
              select: {
                id: true,
                prefix: true,
                first_name: true,
                last_name: true,
                citizenId: true,
                birth_date: true,
                gender: true,
                phone_1: true,
                email: true,
                isActive: true,
              },
            },
            registrations: {
              where: {
                type: "CHECKUP",
                isCancelled: false,
              },
              select: {
                patientId: true,
                registeredAt: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        }),
      ]);
    }

    // Group registrations by patientId (จาก included data)
    const registrationsByPatientId = new Map();
    memberships.forEach((membership) => {
      if (membership.registrations && membership.registrations.length > 0) {
        const reg = membership.registrations[0];
        if (!registrationsByPatientId.has(reg.patientId)) {
          registrationsByPatientId.set(reg.patientId, reg);
        }
      }
    });

    // ดึง scan items และ station remarks พร้อมกัน (optimize: รวม queries)
    const membershipIds = memberships.map((m) => m.id);
    const [scanItems, stationRemarks] =
      membershipIds.length > 0
        ? await Promise.all([
            // ดึง scan items สำหรับแต่ละ membership ที่ station นี้
            prisma.scanItem.findMany({
              where: {
                registration: {
                  patientCNGroupId: { in: membershipIds },
                  type: "CHECKUP",
                  isCancelled: false,
                },
                stationId: parseInt(stationId),
                isCancelled: false,
              },
              select: {
                registration: {
                  select: {
                    patientCNGroupId: true,
                  },
                },
                scannedAt: true,
                scannedByUser: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                scannedAt: "desc",
              },
            }),
            // ดึง StationRemarks สำหรับแต่ละ membership ที่ station นี้
            prisma.stationRemark.findMany({
              where: {
                patientCNGroupId: { in: membershipIds },
                stationId: parseInt(stationId),
              },
              include: {
                reason: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            }),
          ])
        : [[], []];

    // Group scan items by membershipId (ใช้ Map เพื่อ performance)
    const scanItemsByMembershipId = new Map();
    scanItems.forEach((scan) => {
      const membershipId = scan.registration.patientCNGroupId;
      if (!scanItemsByMembershipId.has(membershipId)) {
        scanItemsByMembershipId.set(membershipId, scan);
      }
    });

    // Group station remarks by membershipId (ใช้ Map เพื่อ performance)
    const stationRemarksByMembershipId = new Map();
    stationRemarks.forEach((remark) => {
      stationRemarksByMembershipId.set(remark.patientCNGroupId, remark);
    });

    // Format response
    const formattedPatients = memberships.map((membership) => {
      const patient = membership.patient;
      const registration = registrationsByPatientId.get(patient.id) || null;
      const scanItem = scanItemsByMembershipId.get(membership.id) || null;
      const stationRemark = stationRemarksByMembershipId.get(membership.id) || null;

      return {
        id: patient.id,
        cn: membership.cn || null, // ใช้ cn จาก membership (Patient model ไม่มี field cn)
        prefix: patient.prefix,
        first_name: patient.first_name,
        last_name: patient.last_name,
        citizenId: patient.citizenId,
        birth_date: patient.birth_date,
        gender: patient.gender,
        phone_1: patient.phone_1,
        email: patient.email,
        membershipId: membership.id,
        cn: membership.cn,
        employeeCode: membership.employeeCode,
        position: membership.position,
        department: membership.department,
        companyName: membership.companyName,
        program: membership.program,
        isRegistered: !!registration,
        isScanned: !!scanItem,
        scannedAt: scanItem?.scannedAt || null,
        scannedBy: scanItem?.scannedByUser?.name || null,
        registeredAt: registration?.registeredAt || null,
        registrationCreatedAt: registration?.createdAt || null,
        stationRemark: stationRemark
          ? {
              id: stationRemark.id,
              reason: stationRemark.reason
                ? {
                    id: stationRemark.reason.id,
                    title: stationRemark.reason.title,
                  }
                : null,
              remark: stationRemark.remark || null,
            }
          : null,
      };
    });

    // คำนวณ summary statistics จาก TOTAL data (ไม่กรองตาม filters)
    // เพื่อให้เห็นภาพรวมของ station ตลอดเวลา
    const totalSummaryMissing = Math.max(
      0,
      registeredIds.length - scannedIds.length
    );

    const summary = {
      totalRequired: relevantMembershipIdList.length, // ทั้งหมด
      registeredRequired: registeredIds.length, // ลงทะเบียนทั้งหมด
      scanned: scannedIds.length, // เข้าตรวจทั้งหมด
      missing: totalSummaryMissing, // ขาดตรวจทั้งหมด
      remarked: remarkedMembershipIdList.length, // มีหมายเหตุทั้งหมด
    };

    return {
      success: true,
      data: formattedPatients,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        limit: limit,
      },
      summary,
    };
  } catch (error) {
    console.error("❌ Get Patients By Station Service Error:", error);
    throw error;
  }
};

/**
 * ดึงรายชื่อ patients ตาม Station สำหรับ Customer (Public view)
 * - Summary แสดงข้อมูลทั้งหมดของ station เสมอ (ไม่กรองตาม filter)
 * - ใช้สำหรับ CustomerStationModal
 * @param {string} cnGroupId - CNGroup ID
 * @param {number} stationId - Station ID
 * @param {object} options - { search, page, limit, sortBy, sortOrder, scanStatus, registrationStatus, stationRemarkFilter, companies }
 * @returns {Promise<object>} รายการ patients พร้อม pagination และ summary (total)
 */
export const getPatientsByStationForCustomer = async (cnGroupId, stationId, options = {}) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      sortBy = "cn",
      sortOrder = "asc",
      scanStatus = "all",
      registrationStatus = "all",
      stationRemarkFilter = "all",
      companies = [],
    } = options;

    if (!cnGroupId) throw new Error("CNGroup ID is required");
    if (!stationId) throw new Error("Station ID is required");
    if (!["all", "scanned", "missing"].includes(scanStatus))
      throw new Error("scanStatus must be 'all', 'scanned', or 'missing'");
    if (!["all", "registered", "unregistered"].includes(registrationStatus))
      throw new Error("registrationStatus must be 'all', 'registered', or 'unregistered'");
    if (!["all", "with_remark", "without_remark"].includes(stationRemarkFilter))
      throw new Error("stationRemarkFilter must be 'all', 'with_remark', or 'without_remark'");

    const stationIdInt = parseInt(stationId);
    const companyFilter =
      Array.isArray(companies) && companies.length > 0
        ? { companyName: { in: companies } }
        : {};

    // Batch 1: validate + medicalItems in parallel (3 queries → 1 round trip)
    const [cnGroup, station, stationMedicalItems] = await Promise.all([
      prisma.cNGroup.findUnique({ where: { id: cnGroupId }, select: { id: true } }),
      prisma.station.findUnique({ where: { id: stationIdInt }, select: { id: true } }),
      prisma.stationToMedicalItem.findMany({
        where: { stationId: stationIdInt },
        select: { medicalItemId: true },
      }),
    ]);

    if (!cnGroup) throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    if (!station) throw new Error(`ไม่พบ Station รหัส ${stationId}`);

    const medicalItemIds = stationMedicalItems.map((item) => item.medicalItemId);

    const makeEmptyResult = (summary) => ({
      success: true,
      data: [],
      pagination: { currentPage: page, totalPages: 0, totalItems: 0, limit },
      summary: summary ?? { totalRequired: 0, registeredRequired: 0, scanned: 0, missing: 0, remarked: 0 },
    });

    if (medicalItemIds.length === 0) return makeEmptyResult();

    // Batch 2: resolve membership IDs via direct patientExaminationItem scan
    // — avoids EXISTS subquery on large tables in all subsequent queries
    const examItemRows = await prisma.patientExaminationItem.findMany({
      where: {
        status: "ACTIVE",
        type: "CHECKUP",
        medicalItemId: { in: medicalItemIds },
        patientCNGroup: {
          cnGroupId,
          patient: { isActive: true },
          ...companyFilter,
        },
      },
      select: { patientCNGroupId: true },
    });

    const stationMembershipIds = [...new Set(examItemRows.map((e) => e.patientCNGroupId))];

    if (stationMembershipIds.length === 0) return makeEmptyResult();

    // All subsequent queries use PK IN lookup — no EXISTS subquery
    const membershipPkWhere = { id: { in: stationMembershipIds } };

    // Batch 3: 4 parallel queries — run once, reuse for both summary and filter logic
    const [allMemberships, allRegisteredRaw, allScannedGroupBy, allRemarks] = await Promise.all([
      // membership id + patientId — used for all filter computations in JS
      prisma.cNGroupMembership.findMany({
        where: membershipPkWhere,
        select: { id: true, patientId: true },
      }),
      prisma.registration.findMany({
        where: { patientCNGroupId: { in: stationMembershipIds }, type: "CHECKUP", isCancelled: false },
        select: { patientId: true },
        distinct: ["patientId"],
      }),
      prisma.scanItem.groupBy({
        by: ["patientId"],
        where: {
          stationId: stationIdInt,
          isCancelled: false,
          registration: {
            patientCNGroup: { cnGroupId, ...companyFilter },
            type: "CHECKUP",
            isCancelled: false,
          },
        },
      }),
      prisma.stationRemark.findMany({
        where: { stationId: stationIdInt },
        select: { patientCNGroupId: true },
      }),
    ]);

    // Build O(1) lookup structures from batch 2 results
    const allMembershipIdsSet = new Set(allMemberships.map((m) => m.id));
    const membershipIdToPatientId = new Map(allMemberships.map((m) => [m.id, m.patientId]));
    const registeredPatientIdsSet = new Set(allRegisteredRaw.map((r) => r.patientId));
    const scannedPatientIdsSet = new Set(allScannedGroupBy.map((s) => s.patientId));
    const remarkedMembershipIdsSet = new Set(
      allRemarks
        .filter((r) => allMembershipIdsSet.has(r.patientCNGroupId))
        .map((r) => r.patientCNGroupId)
    );

    const totalSummary = {
      totalRequired: allMemberships.length,
      registeredRequired: allRegisteredRaw.length,
      scanned: allScannedGroupBy.length,
      missing: Math.max(0, allRegisteredRaw.length - allScannedGroupBy.length),
      remarked: remarkedMembershipIdsSet.size,
    };

    // Apply all filters in JS — zero extra DB queries
    let filteredIds = allMemberships.map((m) => m.id);

    if (registrationStatus === "registered") {
      filteredIds = filteredIds.filter((id) =>
        registeredPatientIdsSet.has(membershipIdToPatientId.get(id))
      );
    } else if (registrationStatus === "unregistered") {
      filteredIds = filteredIds.filter((id) =>
        !registeredPatientIdsSet.has(membershipIdToPatientId.get(id))
      );
    }

    if (scanStatus === "scanned") {
      filteredIds = filteredIds.filter((id) =>
        scannedPatientIdsSet.has(membershipIdToPatientId.get(id))
      );
    } else if (scanStatus === "missing") {
      filteredIds = filteredIds.filter((id) => {
        const patientId = membershipIdToPatientId.get(id);
        return registeredPatientIdsSet.has(patientId) && !scannedPatientIdsSet.has(patientId);
      });
    }

    if (stationRemarkFilter === "with_remark") {
      filteredIds = filteredIds.filter((id) => remarkedMembershipIdsSet.has(id));
    } else if (stationRemarkFilter === "without_remark") {
      filteredIds = filteredIds.filter((id) => !remarkedMembershipIdsSet.has(id));
    }

    if (filteredIds.length === 0) return makeEmptyResult(totalSummary);

    // Build search condition (applied on top of PK-based id filter)
    const searchCondition = search
      ? {
          OR: [
            { cn: { contains: search, mode: "insensitive" } },
            { employeeCode: { contains: search, mode: "insensitive" } },
            {
              patient: {
                OR: [
                  { hn: { contains: search, mode: "insensitive" } },
                  { first_name: { contains: search, mode: "insensitive" } },
                  { last_name: { contains: search, mode: "insensitive" } },
                  { citizenId: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : null;

    // Final where: PK lookup (fast index seek) + optional search overlay
    const finalWhere = searchCondition
      ? { id: { in: filteredIds }, AND: [searchCondition] }
      : { id: { in: filteredIds } };

    // OrderBy
    const useRawQueryForRegisteredAt = sortBy === "registeredAt";
    let membershipOrderBy;
    if (sortBy === "name") {
      membershipOrderBy = { patient: { first_name: sortOrder } };
    } else if (useRawQueryForRegisteredAt) {
      membershipOrderBy = null;
    } else if (["employeeCode", "position", "department", "companyName", "cn"].includes(sortBy)) {
      membershipOrderBy = { [sortBy]: sortOrder };
    } else {
      membershipOrderBy = { cn: sortOrder };
    }

    // Batch 3: paginated membership data
    let totalCount, memberships;

    if (useRawQueryForRegisteredAt) {
      // For registeredAt sort: resolve matching IDs first (search filter if any), then raw SQL sort + page
      let sortableIds = filteredIds;
      if (search) {
        const searchMatches = await prisma.cNGroupMembership.findMany({
          where: finalWhere,
          select: { id: true },
        });
        sortableIds = searchMatches.map((m) => m.id);
      }

      totalCount = sortableIds.length;

      if (sortableIds.length === 0) {
        memberships = [];
      } else {
        const orderDirection = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
        const nullsPosition = sortOrder.toUpperCase() === "DESC" ? "NULLS LAST" : "NULLS FIRST";

        const sqlQuery = `
          SELECT
            m.id, m."patientId", m."cnGroupId", m.cn, m."employeeCode", m.position,
            m.department, m."companyName", m.program, m.note, m.remark, m."createdAt", m."updatedAt",
            p.id as "patient_id", p.prefix, p."first_name", p."last_name", p."citizenId",
            p."birth_date", p.gender, p."phone_1", p.email, p."isActive",
            r."patientId" as "reg_patientId", r."registeredAt" as "reg_registeredAt", r."createdAt" as "reg_createdAt"
          FROM "CNGroupMembership" m
          INNER JOIN "Patient" p ON m."patientId" = p.id
          LEFT JOIN LATERAL (
            SELECT "patientId", "registeredAt", "createdAt"
            FROM "Registration"
            WHERE "patientCNGroupId" = m.id AND type = 'CHECKUP' AND "isCancelled" = false
            ORDER BY "createdAt" DESC LIMIT 1
          ) r ON true
          WHERE m.id = ANY($1::text[])
          ORDER BY COALESCE(r."registeredAt", r."createdAt") ${orderDirection} ${nullsPosition}
          LIMIT $2 OFFSET $3
        `;

        const rawResults = await prisma.$queryRawUnsafe(
          sqlQuery,
          sortableIds,
          limit,
          (page - 1) * limit
        );

        memberships = rawResults.map((row) => ({
          id: row.id,
          patientId: row.patientId,
          cnGroupId: row.cnGroupId,
          cn: row.cn,
          employeeCode: row.employeeCode,
          position: row.position,
          department: row.department,
          companyName: row.companyName,
          program: row.program,
          note: row.note,
          remark: row.remark,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          patient: {
            id: row.patient_id,
            prefix: row.prefix,
            first_name: row.first_name,
            last_name: row.last_name,
            citizenId: row.citizenId,
            birth_date: row.birth_date,
            gender: row.gender,
            phone_1: row.phone_1,
            email: row.email,
            isActive: row.isActive,
          },
          registrations: row.reg_patientId
            ? [{ registeredAt: row.reg_registeredAt, createdAt: row.reg_createdAt }]
            : [],
        }));
      }
    } else {
      // count: JS (no query) when no search; DB count only when search narrows results
      const countPromise = search
        ? prisma.cNGroupMembership.count({ where: finalWhere })
        : Promise.resolve(filteredIds.length);

      const dataPromise = prisma.cNGroupMembership.findMany({
        where: finalWhere,
        orderBy: membershipOrderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: {
            select: {
              id: true, prefix: true, first_name: true, last_name: true,
              citizenId: true, birth_date: true, gender: true, phone_1: true,
              email: true, isActive: true,
            },
          },
          registrations: {
            where: { type: "CHECKUP", isCancelled: false },
            select: { id: true, registeredAt: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      [totalCount, memberships] = await Promise.all([countPromise, dataPromise]);
    }

    // Batch 4: enrich page-level data (only limit rows, fast PK IN)
    const pageMembershipIds = memberships.map((m) => m.id);
    const pagePatientIds = memberships.map((m) => m.patientId);

    const [scanItems, stationRemarks] = await Promise.all([
      prisma.scanItem.findMany({
        where: { stationId: stationIdInt, patientId: { in: pagePatientIds }, isCancelled: false },
        select: { patientId: true, scannedAt: true, scannedBy: true },
      }),
      prisma.stationRemark.findMany({
        where: { stationId: stationIdInt, patientCNGroupId: { in: pageMembershipIds } },
        include: { reason: { select: { id: true, title: true } } },
      }),
    ]);

    // Batch 5: scannedBy user names (only IDs present on this page)
    const scannedByUserIds = [...new Set(scanItems.map((s) => s.scannedBy).filter(Boolean))];
    const users =
      scannedByUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: scannedByUserIds } },
            select: { id: true, name: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const scanMap = new Map();
    scanItems.forEach((scan) => {
      if (!scanMap.has(scan.patientId)) scanMap.set(scan.patientId, scan);
    });
    const remarkMap = new Map(stationRemarks.map((r) => [r.patientCNGroupId, r]));

    const formattedPatients = memberships.map((membership) => {
      const registration = membership.registrations?.[0] || null;
      const scanItem = scanMap.get(membership.patientId);
      const stationRemark = remarkMap.get(membership.id);

      return {
        id: membership.id,
        patientId: membership.patientId,
        cn: membership.cn,
        prefix: membership.patient?.prefix || null,
        first_name: membership.patient?.first_name || null,
        last_name: membership.patient?.last_name || null,
        citizenId: membership.patient?.citizenId || null,
        birth_date: membership.patient?.birth_date || null,
        gender: membership.patient?.gender || null,
        phone_1: membership.patient?.phone_1 || null,
        email: membership.patient?.email || null,
        membershipId: membership.id,
        employeeCode: membership.employeeCode,
        position: membership.position,
        department: membership.department,
        companyName: membership.companyName,
        program: membership.program,
        isRegistered: !!registration,
        isScanned: !!scanItem,
        scannedAt: scanItem?.scannedAt || null,
        scannedBy: userMap.get(scanItem?.scannedBy)?.name || null,
        registeredAt: registration?.registeredAt || null,
        registrationCreatedAt: registration?.createdAt || null,
        stationRemark: stationRemark
          ? {
              id: stationRemark.id,
              reason: stationRemark.reason
                ? { id: stationRemark.reason.id, title: stationRemark.reason.title }
                : null,
              remark: stationRemark.remark || null,
            }
          : null,
      };
    });

    return {
      success: true,
      data: formattedPatients,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        limit,
      },
      summary: totalSummary,
    };
  } catch (error) {
    console.error("❌ Get Patients By Station For Customer Service Error:", error);
    throw error;
  }
};

/**
 * Bulk update scan log for a patient
 * @param {string} patientHN - Patient HN
 * @param {string} cnGroupId - CN Group ID
 * @param {Array<number>} stationIds - Array of station IDs
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Result object
 */
export const bulkUpdateScanlog = async (patientHN, cnGroupId, stationIds, userId) => {
  try {
    // Find patient and membership
    const membership = await prisma.cNGroupMembership.findFirst({
      where: {
        cnGroupId,
        patient: { hn: patientHN }
      },
      include: {
        patient: {
          select: { id: true }
        },
        registrations: {
          where: {
            type: 'CHECKUP',
            isCancelled: false
          },
          orderBy: { registeredAt: 'desc' },
          take: 1
        }
      }
    })

    if (!membership) {
      return {
        success: false,
        message: 'ไม่พบผู้ป่วยใน CNGroup นี้'
      }
    }

    const registration = membership.registrations[0]
    if (!registration) {
      return {
        success: false,
        message: 'ผู้ป่วยยังไม่ได้ลงทะเบียน'
      }
    }

    // Get stations for names
    const stations = await prisma.station.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, name: true }
    })

    // Get existing scanItems
    const existingScanItems = await prisma.scanItem.findMany({
      where: {
        patientId: membership.patientId,
        registrationId: registration.id,
        isCancelled: false
      },
      select: { stationId: true }
    })

    const existingStationIds = existingScanItems.map(item => item.stationId)
    const toAdd = stationIds.filter(id => !existingStationIds.includes(id))
    const toCancel = existingStationIds.filter(id => !stationIds.includes(id))

    // Cancel scanItems
    if (toCancel.length > 0) {
      await prisma.scanItem.updateMany({
        where: {
          patientId: membership.patientId,
          registrationId: registration.id,
          stationId: { in: toCancel },
          isCancelled: false
        },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledBy: userId ? parseInt(userId) : null
        }
      })
    }

    // Create new scanItems
    if (toAdd.length > 0) {
      const scanItemsToCreate = toAdd.map(stationId => ({
        patientId: membership.patientId,
        registrationId: registration.id,
        stationId,
        scannedBy: userId ? parseInt(userId) : null,
        scanType: 'BULK'
      }))

      await prisma.scanItem.createMany({
        data: scanItemsToCreate
      })
    }

    const addedNames = toAdd.map(id => {
      const station = stations.find(s => s.id === id)
      return station?.name || id
    }).join(', ')

    const cancelledNames = toCancel.map(id => {
      const station = stations.find(s => s.id === id)
      return station?.name || id
    }).join(', ')

    let message = ''
    if (toAdd.length > 0 && toCancel.length > 0) {
      message = `เพิ่มการสแกน ${toAdd.length} จุด (${addedNames}) และยกเลิก ${toCancel.length} จุด (${cancelledNames})`
    } else if (toAdd.length > 0) {
      message = `เพิ่มการสแกน ${toAdd.length} จุด: ${addedNames}`
    } else if (toCancel.length > 0) {
      message = `ยกเลิกการสแกน ${toCancel.length} จุด: ${cancelledNames}`
    } else {
      message = 'ไม่มีการเปลี่ยนแปลง'
    }

    return {
      success: true,
      message
    }
  } catch (error) {
    console.error('Error in bulkUpdateScanlog:', error)
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการสแกน',
      error: error.message
    }
  }
}

/**
 * ดึงรายชื่อ Users ที่เคยลงทะเบียนใน CNGroup นั้น
 * @param {string} cnGroupId - CNGroup ID
 * @returns {Promise<Array>} [{ id, name }]
 */
export const getRegisteringUsers = async (cnGroupId) => {
  try {
    if (!cnGroupId) {
      throw new Error("CNGroup ID is required");
    }

    const registrations = await prisma.registration.findMany({
      where: {
        patientCNGroup: {
          cnGroupId: cnGroupId,
        },
        type: "CHECKUP",
        isCancelled: false,
        createdBy: { not: null },
      },
      select: {
        createdBy: true,
      },
      distinct: ["createdBy"],
    });

    const userIds = registrations.map((r) => r.createdBy).filter(Boolean);

    if (userIds.length === 0) {
      return [];
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return users;
  } catch (error) {
    console.error("❌ Get Registering Users Service Error:", error);
    throw error;
  }
}