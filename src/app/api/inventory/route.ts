import { NextResponse } from 'next/server';
import {
  getProducts,
  getInventoryMovements,
  restockProduct,
  adjustProductStock,
  saveProduct,
  getProductById
} from '@/lib/store';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const [products, movements] = await Promise.all([
      getProducts(),
      getInventoryMovements(),
    ]);

    const totalSkus = products.length;
    const totalUnits = products.reduce((acc, p) => acc + (p.stockCount || 0), 0);
    const totalCostValue = products.reduce((acc, p) => acc + ((p.costPrice || 0) * (p.stockCount || 0)), 0);
    const totalRetailValue = products.reduce((acc, p) => acc + ((p.price || 0) * (p.stockCount || 0)), 0);
    const potentialProfit = Math.max(0, totalRetailValue - totalCostValue);

    const lowStockProducts = products.filter(
      p => p.stockCount > 0 && p.stockCount <= (p.minStockAlert || 5)
    );
    const outOfStockProducts = products.filter(p => p.stockCount === 0);

    return NextResponse.json({
      summary: {
        totalSkus,
        totalUnits,
        totalCostValue,
        totalRetailValue,
        potentialProfit,
        profitMarginPercent: totalRetailValue > 0 ? Math.round((potentialProfit / totalRetailValue) * 100) : 0,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
      },
      products,
      movements,
      lowStockProducts,
      outOfStockProducts
    });
  } catch (error) {
    console.error('Inventory GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'restock') {
      const { productId, quantity, unitCost, supplierOrInvoice, note, variantId } = body;
      if (!productId || !quantity || Number(quantity) <= 0) {
        return NextResponse.json({ error: 'প্রোডাক্ট এবং সঠিক স্টক সংখ্যা দিন' }, { status: 400 });
      }

      const updated = await restockProduct(
        productId,
        Number(quantity),
        unitCost ? Number(unitCost) : undefined,
        supplierOrInvoice,
        note,
        variantId
      );

      if (!updated) {
        return NextResponse.json({ error: 'প্রোডাক্টটি খুঁজে পাওয়া যায়নি' }, { status: 404 });
      }

      return NextResponse.json({ success: true, product: updated });
    }

    if (action === 'adjust') {
      const { productId, newStock, reason, note, variantId } = body;
      if (!productId || newStock === undefined || Number(newStock) < 0) {
        return NextResponse.json({ error: 'প্রোডাক্ট এবং সঠিক নতুন স্টক সংখ্যা দিন' }, { status: 400 });
      }

      const updated = await adjustProductStock(
        productId,
        Number(newStock),
        reason || 'ADJUSTMENT',
        note,
        variantId
      );

      if (!updated) {
        return NextResponse.json({ error: 'প্রোডাক্টটি খুঁজে পাওয়া যায়নি' }, { status: 404 });
      }

      return NextResponse.json({ success: true, product: updated });
    }

    if (action === 'update_sku_barcode') {
      const { productId, sku, barcode, costPrice, minStockAlert, supplier } = body;
      const prod = await getProductById(productId);
      if (!prod) {
        return NextResponse.json({ error: 'প্রোডাক্ট পাওয়া যায়নি' }, { status: 404 });
      }

      const updated = await saveProduct({
        ...prod,
        sku: sku || prod.sku,
        barcode: barcode || prod.barcode,
        costPrice: costPrice !== undefined ? Number(costPrice) : prod.costPrice,
        minStockAlert: minStockAlert !== undefined ? Number(minStockAlert) : prod.minStockAlert,
        supplier: supplier || prod.supplier
      });

      return NextResponse.json({ success: true, product: updated });
    }

    return NextResponse.json({ error: 'Invalid inventory action' }, { status: 400 });
  } catch (error) {
    console.error('Inventory POST error:', error);
    return NextResponse.json({ error: 'Failed to process inventory request' }, { status: 500 });
  }
}
